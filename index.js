/**
 * Control your medicine reminder with your voice, using Amazon Alexa, Lambda, IOT, MQTT.
 */

var awsIot = require('aws-iot-device-sdk');
var config = require("./config");

var deviceName = "tom_thing";
 
var mqtt_config = {
    "keyPath": "./certs/8a3fa0fd37-private.pem.key",
    "certPath": "./certs/8a3fa0fd37-certificate.pem.crt",
    "caPath": "./certs/rootCA.key",
    "host": config.host,
    "port": 8883,
    "clientId": "RaspberryPi-" + deviceName, 
    "region":"us-east-1",
    "debug":true
};

var ctx = null;
var client = null;

// Route the incoming request based on type (LaunchRequest, IntentRequest, etc.) The JSON body of the request is provided in the event parameter.
exports.handler = function (event, context) {
    try {
        console.log("event.session.application.applicationId=" + event.session.application.applicationId);
        ctx = context;

        if (event.session.application.applicationId !== config.app_id) {
             ctx.fail("Invalid Application ID");
        }

        client = awsIot.device(mqtt_config);

        client.on("connect",function(){
            console.log("Connected to AWS IoT");
        });


        if (event.session.new) {
            onSessionStarted({requestId: event.request.requestId}, event.session);
        }

        if (event.request.type === "LaunchRequest") {
            onLaunch(event.request, event.session);
        }  else if (event.request.type === "IntentRequest") {
            onIntent(event.request, event.session);
        } else if (event.request.type === "SessionEndedRequest") {
            onSessionEnded(event.request, event.session);
            ctx.succeed();
        }
    } catch (e) {
        console.log("EXCEPTION in handler:  " + e);
        ctx.fail("Exception: " + e);
    }
};

/**
 * Called when the session starts.
 */
function onSessionStarted(sessionStartedRequest, session) {
    console.log("onSessionStarted requestId=" + sessionStartedRequest.requestId + ", sessionId=" + session.sessionId);
}


/**
 * Called when the user launches the skill without specifying what they want.
 */
function onLaunch(launchRequest, session, callback) {
    console.log("onLaunch requestId=" + launchRequest.requestId + ", sessionId=" + session.sessionId);

    // Dispatch to your skill's launch.
    getWelcomeResponse(callback);
}

/**
 * Called when the user specifies an intent for this skill.
 */
function onIntent(intentRequest, session ) {
    console.log("onIntent requestId=" + intentRequest.requestId + ", sessionId=" + session.sessionId);

    var intent = intentRequest.intent,
    intentName = intentRequest.intent.name;

    console.log("REQUEST to string =" + JSON.stringify(intentRequest));

    var callback = null;
    // Dispatch to your skill's intent handlers
    if ("SetReminder" === intentName) {
        SetReminderCommandIntent(intent, session);
    }else if ("ClearReminder" === intentName) {
        ClearReminderCommandIntent(intent, session);
    } else {
        throw "Invalid intent";
    }

}

/**
 * Called when the user ends the session.
 * Is not called when the skill returns shouldEndSession=true.
 */
function onSessionEnded(sessionEndedRequest, session) {
    console.log("onSessionEnded requestId=" + sessionEndedRequest.requestId + ", sessionId=" + session.sessionId);
    // Add cleanup logic here
}

// --------------- Functions that control the skill's behavior -----------------------

function getWelcomeResponse() {
    // If we wanted to initialize the session to have some attributes we could add those here.
    var sessionAttributes = {};
    var cardTitle = "Welcome";
    var speechOutput = "Welcome to the My Medicine Reminder.";

    var repromptText = "Medicine Reminder ready for command.";
    var shouldEndSession = false;

    ctx.succeed(buildResponse(sessionAttributes, buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession)));
}


function SetReminderCommandIntent(intent, session, callback) {
    var repromptText = null;
    var sessionAttributes = {};
    var shouldEndSession = true;
    var speechOutput = "";

    repromptText = "Tell me what is the command for the Medicine Reminder.";

    var time = intent.slots.Time.value;
    
    var cardTitle = "Set Reminder Time" ;
    speechOutput = "Setting reminder time to " + time  ;
    mqttPublish(intent, sessionAttributes, cardTitle, speechOutput, repromptText, shouldEndSession);
}

function ClearReminderCommandIntent(intent, session, callback) {
    var repromptText = null;
    var sessionAttributes = {};
    var shouldEndSession = true;
    var speechOutput = "";

    repromptText = "Tell me what is the command for the Medicine Reminder.";

    var time = intent.slots.Time.value;
    
    var cardTitle = "Clear Reminder Time" ;
    speechOutput = "Clearing reminder time " + time  ;
    mqttPublish(intent, sessionAttributes, cardTitle, speechOutput, repromptText, shouldEndSession);
}


function mqttPublish(intent, sessionAttributes, cardTitle, speechOutput, repromptText, shouldEndSession)
{
    var strIntent = JSON.stringify(intent);
    console.log("mqttPublish:  INTENT text = " + strIntent);
    
    client.publish(config.topic, strIntent, function() {
        client.end();
    });
    
    client.on("close", (function () {
        console.log("MQTT CLIENT CLOSE - thinks it's done, successfully. ");
        ctx.succeed(buildResponse(sessionAttributes, buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession)));
    }));

    client.on("error", (function (err, granted) {
        console.log("MQTT CLIENT ERROR!!  " + err);
    }));
}


// --------------- Helpers that build all of the responses -----------------------

function buildSpeechletResponse(title, output, repromptText, shouldEndSession) {
    return {
        outputSpeech: {
            type: "PlainText",
            text: output
        },
        card: {
            type: "Simple",
            title: title,
            content: output
        },
        reprompt: {
            outputSpeech: {
                type: "PlainText",
                text: repromptText
            }
        },
        shouldEndSession: shouldEndSession
    }
}

function buildResponse(sessionAttributes, speechletResponse) {
    return {
        version: "1.0",
        sessionAttributes: sessionAttributes,
        response: speechletResponse
    }
}