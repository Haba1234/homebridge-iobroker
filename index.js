'use strict';

let Accessory, Service, Characteristic, UUIDGen;
let servConn = require('./lib/conn.js');
let states = [];

module.exports = function (homebridge) {
  console.log("homebridge API version: " + homebridge.version);

  // Accessory must be created from PlatformAccessory Constructor
  Accessory = homebridge.platformAccessory;

  // Service and Characteristic are from hap-nodejs
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  UUIDGen = homebridge.hap.uuid;
  
  // For platform plugin to be considered as dynamic platform plugin,
  // registerPlatform(pluginName, platformName, constructor, dynamic), dynamic must be true
  homebridge.registerPlatform("homebridge-iobroker", "iobroker", iobroker, true);
}

// Platform constructor
// config may be null
// api may be null if launched from old homebridge version
function iobroker(log, config, api) {
  log("iobroker Init");
  var platform = this;
  this.host = config.host;
  log("iobroker host = " + this.host);
  this.log = log;
  this.config = config;
  this.switches = this.config.switches || [];
  this.accessories = {};
  this.polling = {};

  if (api) {
      // Save the API object as plugin needs to register new accessory via this object
      this.api = api;
      this.Conn = new servConn();
      
      // Listen to event "didFinishLaunching", this means homebridge already finished loading cached accessories.
      // Platform Plugin should only register new accessory that doesn't exist in homebridge after this event.
      // Or start discover new accessories.
      this.api.on('didFinishLaunching', function() {
        platform.log.info("DidFinishLaunching");
        this.log.debug("Number of chaced Accessories: %s", this.cachedAccessories);
        this.log.info("Number of Accessories: %s", Object.keys(this.accessories).length);
        //this.didFinishLaunching();
        this.log('Start socket');
  //servConn.namespace = 'homebridge';
  //servConn._useStorage = false;
  //utils.servConn.socketUrl = "local";
        var that = this;
        this.Conn.init({
            "name":          'homebridge',  // optional - default 'vis.0'
            "connLink":      this.host,    // optional URL of the socket.io adapter
            "socketSession": '',            // optional - used by authentication
            "platform": this
        }, {
            "onConnChange": function (isConnected) {
                if (isConnected) {
                    platform.log.info('Socket: connected');
                    that.Conn.getVersion(function(data){
                        platform.log.debug("Socket Version = " + data);
                    });
                    that.didFinishLaunching();
                    platform.log.debug('this.switches ' + that.switches);
                    //that.Conn.getObjects('javascript.0.Signalka.battery'); 
                } else {
                    platform.log.info('Socket: disconnected');
                }
            },
            "onUpdate": function (id, state) {
                setTimeout(function () {
                    platform.log.info('NEW VALUE of ' + id + ': ' + JSON.stringify(state));
                }, 0);
                //platform.log.info('that.accessories[id] ' + JSON.stringify(that.accessories[id]));
                if (that.accessories[id] !== 'undefined') {
                    let accessory = that.accessories[id];
                    accessory
                      .getService(Service.Switch)
                      .getCharacteristic(Characteristic.On)
                      //.setValue(state.val);
                      .updateValue(state.val);
                    platform.log.info('Save new state = ' + state.val + ' => ' + id);
                }
                //platform.log.info('accessory = ' + JSON.stringify(accessory));
            },
            "onError": function (err) {}
        });        
      }.bind(this));
      this.log.debug("WebsocketPlatform %s", JSON.stringify(this.accessories));
  }
}

// Function invoked when homebridge tries to restore cached accessory.
// Developer can configure accessory at here (like setup event handler).
// Update current value.
iobroker.prototype.configureAccessory = function(accessory) {
  this.log.debug(accessory.displayName, "Configure Accessory");
  var platform = this;
  //this.log("this.accessories: " + JSON.stringify(this.accessories));
  //this.log("accessory: " + JSON.stringify(accessory));
  this.setService(accessory);  
  this.accessories[accessory.displayName] = accessory;
  // или this.accessories.push(accessory);
  this.log.debug("Configure Accessory: accessory.displayName = " + accessory.displayName);
}

iobroker.prototype.addAccessory = function (data) {
  this.log.debug("Add Accessory");
  this.log.debug("Initializing platform accessory '" + data + "'..."); //data.name
  var platform = this;
  var uuid;
  
  // Retrieve accessory from cache
  var accessory = this.accessories[data];
  //this.log.debug("this.accessories: " + JSON.stringify(this.accessories[data]));
  if (!accessory) {
    uuid = UUIDGen.generate(data);
    this.log.debug("uuid = " + uuid);
    accessory = new Accessory(data, uuid);

    // Setup HomeKit switch service
    accessory.addService(Service.Switch, data);
    
    // New accessory is always reachable
    accessory.reachable = true;
    
    // Setup listeners for different switch events
    this.setService(accessory);
    
    // Register new accessory in HomeKit
    this.api.registerPlatformAccessories("homebridge-iobroker", "iobroker", [accessory]);

    // Store accessory in cache
    this.accessories[data] = accessory;
  }
  
  // Confirm variable type
  //data.polling = data.polling === true;
  
  // Store and initialize variables into context
  //var cache = accessory.context;
  //cache.name = data.name;
  //cache.polling = data.polling;
  
  //if (cache.state === undefined) {
  //  cache.state = false;
  //  this.log.debug("cache.state = " + cache.state);
  //}
  
  
  // Retrieve initial state
  this.getInitState(accessory);
  
  // Configure state polling
  //this.log.debug("data.polling:" + data.polling);
  //if (data.polling) this.statePolling(data);
}

// Method to setup listeners for different events
iobroker.prototype.setService = function (accessory) {
    this.log.debug("iobroker.prototype.setService");
    //this.log.debug("accessory.context: " + JSON.stringify(accessory.context));
    this.log.debug("accessory.displayName: " + JSON.stringify(accessory.displayName));
    accessory.getService(Service.Switch) 
      .getCharacteristic(Characteristic.On)
      .on('get', this.getState.bind(this, accessory))
      .on('set', this.setState.bind(this, accessory)); //accessory
    
    this.log.debug(accessory.displayName, "Light -> ");
    
    accessory.on('identify', this.identify.bind(this, accessory.displayName));
}

// Method to setup accesories from config.json
iobroker.prototype.didFinishLaunching = function () {
  // Add or update accessories defined in config.json
  this.log.debug("iobroker.prototype.didFinishLaunching");
  for (let i in this.switches) {
      this.log.debug(i + " addAccessory = " + this.switches[i]);
      this.addAccessory(this.switches[i]);
  }

  // Remove extra accessories in cache
  for (var name in this.accessories) {
    var accessory = this.accessories[name];
    if (!accessory.reachable) this.removeAccessory(accessory);
  }
}

// Method to retrieve initial state
// Метод получения начального состояния
iobroker.prototype.getInitState = function (accessory) {
  this.log.debug("iobroker.prototype.getInitState"); 
  var manufacturer = accessory.context.manufacturer || "Default-Manufacturer";
  var model = accessory.context.model || "Default-Model";
  var serial = accessory.context.serial || "Default-SerialNumber";

  // Update HomeKit accessory information
  accessory.getService(Service.AccessoryInformation)
    .setCharacteristic(Characteristic.Manufacturer, manufacturer)
    .setCharacteristic(Characteristic.Model, model)
    .setCharacteristic(Characteristic.SerialNumber, serial);

  // Retrieve initial state if polling is disabled
  if (!accessory.context.polling) {
    accessory.getService(Service.Switch)
      .getCharacteristic(Characteristic.On)
      .getValue();
  }

  // Configured accessory is reachable
  // Set the accessory to reachable if plugin can currently process the accessory,
  // otherwise set to false and update the reachability later by invoking 
  // accessory.updateReachability()
  //accessory.reachable = true;  
  accessory.updateReachability(true);
}

iobroker.prototype.setState = function (accessory, state, callback) {
    this.log.debug("Setting current state...");
    let that = this;
    this.log.debug("accessory.displayName: " + accessory.displayName + " state = " + state);
    this.Conn.setState(accessory.displayName, state);
    //thisSwitch.state = state;
    callback();
}

iobroker.prototype.getState = function (accessory, callback) {
    //var platform = this;
    this.log.debug("Getting current state...");
    var that = this;
    //this.log("thisSwitch.name " + JSON.stringify(thisSwitch) + " state.");
    //this.log("accessory.displayName " + JSON.stringify(accessory));
    var ID = accessory.displayName;
    this.log.debug("accessory.displayName " + ID);
    this.Conn.getStates(ID, function(error, data) {  
        if (error) that.log.error("getState.error: " + error);
        that.log.debug(ID + ": data = " + JSON.stringify(data[ID]));
        //thisSwitch.state = data[accessory.displayName].val;
        var stat = false;
        if (JSON.stringify(data) !== '{}') stat = data[ID].val;
        callback (error, stat)
    }); //  callback (null, true);
}

// Method to determine current state
// Определение текущего состояния
iobroker.prototype.statePolling = function (name) {
  this.log.debug("iobroker.prototype.statePolling");
  var accessory = this.accessories[name];
  var thisSwitch = accessory.context;

  // Clear polling
  clearTimeout(this.polling[name]);

  this.getState(thisSwitch, function (error, state) {
    // Update state if there's no error
    if (!error && state !== thisSwitch.state) {
      thisSwitch.state = state;
      accessory.getService(Service.Switch)
        .getCharacteristic(Characteristic.On)
        .getValue();
    }
  });

  // Setup for next polling
  this.polling[name] = setTimeout(this.statePolling.bind(this, name), thisSwitch.interval * 1000);
}


// Method to handle identify request
iobroker.prototype.identify = function (thisSwitch, paired, callback) {
  this.log.debug(thisSwitch.name + " identify requested!");
  callback();
}

iobroker.prototype.updateAccessoriesReachability = function() {
    this.log.debug("Update Reachability");
    for (var index in this.accessories) {
        var accessory = this.accessories[index];
        accessory.updateReachability(false);
    }
}

// Method to remove accessories from HomeKit
iobroker.prototype.removeAccessory = function (accessory) {
  if (accessory) {
    var name = accessory.displayName;
    this.log.debug(name + " is removed from HomeBridge.");
    this.api.unregisterPlatformAccessories("homebridge-iobroker", "iobroker", [accessory]);
    delete this.accessories[name];
  }
}

// Handler will be invoked when user try to config your plugin.
// Callback can be cached and invoke when necessary.
iobroker.prototype.configurationRequestHandler = function(context, request, callback) {
  platform.log("Context: ", JSON.stringify(context));
  platform.log("Request: ", JSON.stringify(request));

  // Check the request response
  if (request && request.response && request.response.inputs && request.response.inputs.name) {
    this.addAccessory(request.response.inputs.name);

    // Invoke callback with config will let homebridge save the new config into config.json
    // Callback = function(response, type, replace, config)
    // set "type" to platform if the plugin is trying to modify platforms section
    // set "replace" to true will let homebridge replace existing config in config.json
    // "config" is the data platform trying to save
    callback(null, "platform", true, {"platform":"iobroker", "otherConfig":"SomeData"});
    return;
  }

  // - UI Type: Input
  // Can be used to request input from user
  // User response can be retrieved from request.response.inputs next time
  // when configurationRequestHandler being invoked

  var respDict = {
    "type": "Interface",
    "interface": "input",
    "title": "Add Accessory",
    "items": [
      {
        "id": "name",
        "title": "Name",
        "placeholder": "Fancy Light"
      }//, 
      // {
      //   "id": "pw",
      //   "title": "Password",
      //   "secure": true
      // }
    ]
  }

  // - UI Type: List
  // Can be used to ask user to select something from the list
  // User response can be retrieved from request.response.selections next time
  // when configurationRequestHandler being invoked

  // var respDict = {
  //   "type": "Interface",
  //   "interface": "list",
  //   "title": "Select Something",
  //   "allowMultipleSelection": true,
  //   "items": [
  //     "A","B","C"
  //   ]
  // }

  // - UI Type: Instruction
  // Can be used to ask user to do something (other than text input)
  // Hero image is base64 encoded image data. Not really sure the maximum length HomeKit allows.

  // var respDict = {
  //   "type": "Interface",
  //   "interface": "instruction",
  //   "title": "Almost There",
  //   "detail": "Please press the button on the bridge to finish the setup.",
  //   "heroImage": "base64 image data",
  //   "showActivityIndicator": true,
  // "showNextButton": true,
  // "buttonText": "Login in browser",
  // "actionURL": "https://google.com"
  // }

  // Plugin can set context to allow it track setup process
  context.ts = "Hello";

  // Invoke callback to update setup UI
  callback(respDict);
}