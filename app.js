"use strict";
const Homey = require('homey');

const brokerMQTT  = require("./broker.js");
const actionsMQTT = require("./actions.js");
const triggerMQTT = require("./triggers.js");

const DEBUG = process.env.DEBUG === '1';
class MQTTApp extends Homey.App {

   /*
      Initialize the MQTT Client app. Register all variables,
      Connect to the broker when the broker is used.
      Register triggers, actions and conditions
   */
   async onInit() {
      this.logmodule = require("./logmodule.js");
      this.broker = new brokerMQTT(this);
      this.triggers = new triggerMQTT(this);
      this.actions = new actionsMQTT(this);

      this.broker.updateRef(this);
    }

   async changedSettings(body) {
      this.logmodule.writelog("changedSettings called");

      // unsubscribe from all registered topics, but keep the registration.
      const topics = this.broker.getTopicsRegistry().getTopics() || [];
      let visited = new Set();
      for(let topic of topics) {
        if(!visited.has(topic.getTopicName())) {
          visited.add(topic.getTopicName());
          await this.broker.unsubscribeFromTopic(topic, true, true);
        }
      }

      // disconnect
      if (this.broker.getConnectedClient() !== null) {
         this.broker.getConnectedClient().end(true);
         this.broker.clearConnectedClient();
      }
      
      // re-connect with new settings
      // NOTE: When the client is connected, all existing topics will be re-subscribed
      this.broker.connectToBroker();
      
      return true;
   }

   getLogLines() {
      return this.logmodule.getLogLines();
   }

   /**
    * sendMessage - Publish a message on a given topic.
    *                  The MQTT broker used is configured in the MQTT client settings.
    *                  If there is no connection, one is setup to the broker.
    *
    * @param  {type} body JSON object containing:
    *                     mqttTopic: Topic the message should be published on
    *                     mqttMessage: Message payload that is posted on the topic.
    *                     qos: 0, 1 or 2 representing the quality of service to be used.
    *                     retain: true when sending as retained message or false.
    * @return {type}      returns an error object on failure or true when succesfull
    */
    sendMessage(body) {
      let response = {
        result: -1,
        error: ""
      }
      if (body !== undefined) {
          try {
            this.broker.sendMessageToTopic(body);
            response.result = 0;
            return response;
          } catch (error) {
              this.logmodule.writelog('error', error);
              response.error=error;
          }
      }
      return response;
    }

    async subscribeToTopic(topic, reference) {
      let response = {
        result: -1,
        error: ""
      }
      this.logmodule.writelog('info', 'API: subscribe to topic: ' + topic);
      try {
          await this.broker.subscribeToApiTopic(topic, reference);
          response.result = 0;
      } catch (error) {
          response.error = error;
      }
      return response;
    }

    async unsubscribeFromTopic(topic, reference) {
      let response = {
        result: -1,
        error: ""
      }
      this.logmodule.writelog('info', 'API: unsubscribe from topic: ' + topic);
      if(reference === 'trigger' || reference === 'api') {
        this.logmodule.writelog('info', '[WARNING] Unsubscribe from topic not allowed');
        response.error = 'Unsubscribe from topic not allowed';
        return response;
      }

      try {
        await this.broker.unsubscribeFromTopicName(topic, reference || 'api');
        response.result = 0;
      } catch (error) {
        response.error = error;
      }
      return response;
    }
    async unsubscribeFromAllTopicsForReference(reference) {
      let response = {
        result: -1,
        error: ""
      }
      try {
        this.logmodule.writelog('info', 'API: unsubscribe from topics with reference: ' + reference);
        await this.broker.unsubscribeFromAllTopicsWithReference(reference);
        response.result = 0;
      } catch (error) {
        response.error = error;
      }
      return response;
    }
}
module.exports = MQTTApp;
