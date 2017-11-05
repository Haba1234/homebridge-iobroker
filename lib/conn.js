'use strict';

const io = require('socket.io-client');

var servConn = function () {
    this.platform =          null;
    this._socket=            null;
    this._onConnChange=      null;
    this._onUpdate=          null;
    this._isConnected=       false;
    this._disconnectedSince= null;
    this._connCallbacks=     {
        onConnChange: null,
        onUpdate:     null,
        onRefresh:    null,
        onAuth:       null,
        onCommand:    null,
        onError:      null
    };
    this._authInfo=          null;
    this._isAuthDone=        false;
    this._isAuthRequired=    false;
    this._authRunning=       false;
    this._cmdQueue=          [];
    this._connTimer=         null;
    this._type=              'socket.io'; // [SignalR | socket.io | local]
    this._timeout=           0;           // 0 - use transport default timeout to detect disconnect
    this._reconnectInterval= 10000;       // reconnect interval
    this._reloadInterval=    30;          // if connection was absent longer than 30 seconds
    this._cmdData=           null;
    this._cmdInstance=       null;
    this._isSecure=          false;
    this._defaultMode=       0x644;
    this._useStorage=        false;
    this._objects=           null;        // used if _useStorage === true
    this._enums=             null;        // used if _useStorage === true
    this.namespace=          'vis.0';
}
servConn.prototype.getType = function () {return this._type;};
servConn.prototype.getIsConnected = function () {return this._isConnected;};
servConn.prototype.getIsloginRequired = function () {return this._isSecure;};
servConn.prototype.getUser = function () {return this._user;};
servConn.prototype.setReloadTimeout = function (timeout){
        this._reloadInterval = parseInt(timeout, 10);    
    };
servConn.prototype.setReconnectInterval = function (interval){
        this._reconnectInterval = parseInt(interval, 10);
    };
servConn.prototype._checkConnection = function (func, _arguments) {
        if (!this._isConnected) {
            console.log('No connection!');
            return false;
        }

        if (this._queueCmdIfRequired(func, _arguments)) return false;

        //socket.io
        if (this._socket === null) {
            console.log('socket.io not initialized');
            return false;
        }
        return true;
    };
servConn.prototype._monitor = function () {
        if (this._timer) return;
        var ts = (new Date()).getTime();
        if (this._reloadInterval && ts - this._lastTimer > this._reloadInterval * 1000) {
            // It seems, that PC was in a sleep => Reload page to request authentication anew
            //window.location.reload();
        } else {
            this._lastTimer = ts;
        }
        var that = this;
        this._timer = setTimeout(function () {
            that._timer = null;
            that._monitor();
        }, 10000);
    };
servConn.prototype._onAuth = function (objectsRequired, isSecure) {
        var that = this;

        this._isSecure = isSecure;

        if (this._isSecure) {
            that._lastTimer = (new Date()).getTime();
            this._monitor();
        }

        this._socket.emit('subscribe', "*"); //"/^mysensors\.0\.61\./"  "javascript.0.Signalka*"
        if (objectsRequired) this._socket.emit('subscribeObjects', '*');

        if (this._isConnected === true) {
            // This seems to be a reconnect because we're already connected!
            // -> prevent firing onConnChange twice
            return;
        }
        this._isConnected = true;
        if (this._connCallbacks.onConnChange) {
            setTimeout(function () {
                that._socket.emit('authEnabled', function (auth, user) {
                    that._user = user;
                    that._connCallbacks.onConnChange(that._isConnected);
                    if (typeof app !== 'undefined') app.onConnChange(that._isConnected);
                });
            }, 0);
        }
    };
servConn.prototype.reconnect = function (connOptions) {
        var that = this;
        // reconnect
        if ((!connOptions.mayReconnect || connOptions.mayReconnect()) && !this._connectInterval) {
            this._connectInterval = setInterval(function () {
                console.log('Trying connect...');
                that._socket.connect();
                that._countDown = Math.floor(that._reconnectInterval / 1000);
                if (typeof $ !== 'undefined') {
                    $('.splash-screen-text').html(that._countDown + '...').css('color', 'red');
                }
            }, this._reconnectInterval);

            this._countDown = Math.floor(this._reconnectInterval / 1000);
            if (typeof $ !== 'undefined') {
                $('.splash-screen-text').html(this._countDown + '...');
            }

            this._countInterval = setInterval(function () {
                that._countDown--;
                if (typeof $ !== 'undefined') {
                    $('.splash-screen-text').html(that._countDown + '...');
                }
            }, 1000);
        }
    };
servConn.prototype.init = function (connOptions, connCallbacks, objectsRequired) {
    var that = this; // support of old safary
    this.platform = connOptions.platform;
    // init namespace
    if (typeof socketNamespace !== 'undefined') this.namespace = socketNamespace;

    connOptions = connOptions || {};
    if (!connOptions.name) connOptions.name = this.namespace;

    if (typeof session !== 'undefined') {
        var user = session.get('user');
        if (user) {
            that._authInfo = {
                user: user,
                hash: session.get('hash'),
                salt: session.get('salt')
            };
        }
    }

    this._connCallbacks = connCallbacks;

    var connLink = connOptions.connLink || window.localStorage.getItem('connLink');

    // Connection data from "/_socket/info.js"
    if (!connLink && typeof socketUrl !== 'undefined') connLink = socketUrl;
    if (!connOptions.socketSession && typeof socketSession !== 'undefined') connOptions.socketSession = socketSession;
    if (connOptions.socketForceWebSockets === undefined &&
        typeof socketForceWebSockets !== 'undefined') {
            connOptions.socketForceWebSockets = socketForceWebSockets;
        }

    // if no remote data
    if (this._type === 'local') {
        // report connected state
        this._isConnected = true;
        if (this._connCallbacks.onConnChange) this._connCallbacks.onConnChange(this._isConnected);
        if (typeof app !== 'undefined') app.onConnChange(this._isConnected);
    } else
        if (typeof io !== 'undefined') {
            connOptions.socketSession = connOptions.socketSession || 'nokey';

            var url;
            if (connLink) {
                url = connLink;
                if (typeof connLink !== 'undefined') {
                    if (connLink[0] === ':') connLink = location.protocol + '://' + location.hostname + connLink;
                }
            } else {
                url = location.protocol + '//' + location.host;
            }

            this._socket = io.connect(url, {
                query:                          'key=' + connOptions.socketSession,
                'reconnection limit':           10000,
                'max reconnection attempts':    Infinity,
                reconnection:                   false,
                upgrade:                        !connOptions.socketForceWebSockets,
                rememberUpgrade:                connOptions.socketForceWebSockets,
                transports:                     connOptions.socketForceWebSockets ? ['websocket'] : undefined
            });

            this._socket.on('connect', function () {
                if (that._disconnectedSince) {
                    var offlineTime = (new Date()).getTime() - that._disconnectedSince;
                    this.platform.log('was offline for ' + (offlineTime / 1000) + 's');

                    // reload whole page if no connection longer than some period
                    //if (that._reloadInterval && offlineTime > that._reloadInterval * 1000) window.location.reload();
                    
                    that._disconnectedSince = null;
                }

                if (that._connectInterval) {
                    clearInterval(that._connectInterval);
                    that._connectInterval = null;
                }
                if (that._countInterval) {
                    clearInterval(that._countInterval);
                    that._countInterval = null;
                }
                //var elem = document.getElementById('server-disconnect');
                //if (elem) elem.style.display = 'none';

                that._socket.emit('name', connOptions.name);
                that.platform.log((new Date()).toISOString() + ' Connected => authenticate');
                setTimeout(function () {
                    var wait = setTimeout(function() {
                        this.platform.error('No answer from server')
                        //window.location.reload();
                    }, 3000);

                    that._socket.emit('authenticate', function (isOk, isSecure) {
                        clearTimeout(wait);
                        that.platform.log((new Date()).toISOString() + ' Authenticated: ' + isOk);
                        if (isOk) {
                            that._onAuth(objectsRequired, isSecure);
                        } else {
                            that.platform.log('permissionError');
                        }
                    });
                }, 50);
            });

            this._socket.on('reauthenticate', function () {
                if (that._connCallbacks.onConnChange) {
                    that._connCallbacks.onConnChange(false);
                    if (typeof app !== 'undefined') app.onConnChange(false);
                }
                this.platform.warn('reauthenticate');
                //window.location.reload();
            });

            this._socket.on('connect_error', function () {
                that.reconnect(connOptions);
            });

            this._socket.on('disconnect', function () {
                that._disconnectedSince = (new Date()).getTime();

                // called only once when connection lost (and it was here before)
                that._isConnected = false;
                if (that._connCallbacks.onConnChange) {
                    setTimeout(function () {
                        that._connCallbacks.onConnChange(that._isConnected);
                        if (typeof app !== 'undefined') app.onConnChange(that._isConnected);
                    }, 5000);
                } else {
                    //var elem = document.getElementById('server-disconnect');
                    //if (elem) elem.style.display = '';
                }

                // reconnect
                that.reconnect(connOptions);
            });

            // after reconnect the "connect" event will be called
            this._socket.on('reconnect', function () {
                var offlineTime = (new Date()).getTime() - that._disconnectedSince;
                that.platform.log('was offline for ' + (offlineTime / 1000) + 's');
            });

            this._socket.on('objectChange', function (id, obj) {
                // If cache used
                if (that._useStorage && typeof storage !== 'undefined') {
                    var objects = that._objects || storage.get('objects');
                    if (objects) {
                        if (obj) {
                            objects[id] = obj;
                        } else {
                            if (objects[id]) delete objects[id];
                        }
                        storage.set('objects',  objects);
                    }
                }

                if (that._connCallbacks.onObjectChange) that._connCallbacks.onObjectChange(id, obj);
            });

            this._socket.on('stateChange', function (id, state) {
                if (!id || state === null || typeof state !== 'object') return;

                if (that._connCallbacks.onCommand && id === that.namespace + '.control.command') {
                    if (state.ack) return;

                    if (state.val &&
                        typeof state.val === 'string' &&
                        state.val[0] === '{' &&
                        state.val[state.val.length - 1] === '}') {
                        try {
                            state.val = JSON.parse(state.val);
                        } catch (e) {
                            that.platform.log('Command seems to be an object, but cannot parse it: ' + state.val);
                        }
                    }

                    // if command is an object {instance: 'iii', command: 'cmd', data: 'ddd'}
                    if (state.val && state.val.instance) {
                        if (that._connCallbacks.onCommand(state.val.instance, state.val.command, state.val.data)) {
                            // clear state
                            that.setState(id, {val: '', ack: true});
                        }
                    } else {
                        if (that._connCallbacks.onCommand(that._cmdInstance, state.val, that._cmdData)) {
                            // clear state
                            that.setState(id, {val: '', ack: true});
                        }
                    }
                } else if (id === that.namespace + '.control.data') {
                    that._cmdData = state.val;
                } else if (id === that.namespace + '.control.instance') {
                    that._cmdInstance = state.val;
                } else if (that._connCallbacks.onUpdate) {
                    that._connCallbacks.onUpdate(id, state);
                }
            });

            this._socket.on('permissionError', function (err) {
                if (that._connCallbacks.onError) {
                    /* {
                     command:
                     type:
                     operation:
                     arg:
                     }*/
                    that._connCallbacks.onError(err);
                } else {
                    that.platform.log('permissionError');
                }
            });
        }
    };
servConn.prototype.logout = function (callback) {
        if (!this._isConnected) {
            console.log('No connection!');
            return;
        }

        this._socket.emit('logout', callback);
    };
servConn.prototype.getVersion = function (callback) {
        if (!this._checkConnection('getVersion', arguments)) return;

        this._socket.emit('getVersion', function (version) {
            if (callback) callback(version);
        });
    };
servConn.prototype._checkAuth = function (callback) {
        if (!this._isConnected) {
            console.log('No connection!');
            return;
        }
        //socket.io
        if (this._socket === null) {
            console.log('socket.io not initialized');
            return;
        }
        this._socket.emit('getVersion', function (version) {
            if (callback)
                callback(version);
        });
    };
servConn.prototype.setState = function (pointId, value, callback) {
        //socket.io
        if (this._socket === null) {
            //console.log('socket.io not initialized');
            return;
        }
        this._socket.emit('setState', pointId, value, callback);
    };
    // callback(err, data)
servConn.prototype.getStates = function (IDs, callback) {
        if (typeof IDs === 'function') {
            callback = IDs;
            IDs = null;
        }

        if (this._type === 'local') {
            return callback(null, []);
        } else {
            if (!this._checkConnection('getStates', arguments)) return;

            this.gettingStates = this.gettingStates || 0;
            this.gettingStates++;
            if (this.gettingStates > 1) {
                // fix for slow devices
                console.log('Trying to get empty list, because the whole list could not be loaded');
                IDs = [];
            }
            var that = this;
            this._socket.emit('getStates', IDs, function (err, data) {
                that.gettingStates--;
                if (err || !data) {
                    if (callback) {
                        callback(err || 'Authentication required');
                    }
                } else if (callback) {
                    callback(null, data);
                }
            });
        }
    };
servConn.prototype._fillChildren = function (objects) {
        var items = [];

        for (var id in objects) {
            items.push(id);
        }
        items.sort();

        for (var i = 0; i < items.length; i++) {
            if (objects[items[i]].common) {
                var j = i + 1;
                var children = [];
                var len      = items[i].length + 1;
                var name     = items[i] + '.';
                while (j < items.length && items[j].substring(0, len) === name) {
                    children.push(items[j++]);
                }

                objects[items[i]].children = children;
            }
        }
    };
servConn.prototype.getObjects = function (useCache, callback) {
        if (typeof useCache === 'function') {
            callback = useCache;
            useCache = false;
        }
        // If cache used
        if (this._useStorage && useCache) {
            if (typeof storage !== 'undefined') {
                var objects = this._objects || storage.get('objects');
                if (objects) return callback(null, objects);
            } else if (this._objects) {
                return callback(null, this._objects);
            }
        }

        if (!this._checkConnection('getObjects', arguments)) return;
        var that = this;
        this._socket.emit('getObjects', function (err, data) {

            // Read all enums
            that._socket.emit('getObjectView', 'system', 'enum', {startkey: 'enum.', endkey: 'enum.\u9999'}, function (err, res) {
                if (err) {
                    callback(err);
                    return;
                }
                var result = {};
                var enums  = {};
                for (var i = 0; i < res.rows.length; i++) {
                    data[res.rows[i].id] = res.rows[i].value;
                    enums[res.rows[i].id] = res.rows[i].value;
                }

                // Read all adapters for images
                that._socket.emit('getObjectView', 'system', 'instance', {startkey: 'system.adapter.', endkey: 'system.adapter.\u9999'}, function (err, res) {
                    if (err) {
                        callback(err);
                        return;
                    }
                    var result = {};
                    for (var i = 0; i < res.rows.length; i++) {
                        data[res.rows[i].id] = res.rows[i].value;
                    }
                    // find out default file mode
                    if (data['system.adapter.' + that.namespace] &&
                        data['system.adapter.' + that.namespace].native &&
                        data['system.adapter.' + that.namespace].native.defaultFileMode) {
                        that._defaultMode = data['system.adapter.' + that.namespace].native.defaultFileMode;
                    }

                    // Read all channels for images
                    that._socket.emit('getObjectView', 'system', 'channel', {startkey: '', endkey: '\u9999'}, function (err, res) {
                        if (err) {
                            callback(err);
                            return;
                        }
                        var result = {};
                        for (var i = 0; i < res.rows.length; i++) {
                            data[res.rows[i].id] = res.rows[i].value;
                        }

                        // Read all devices for images
                        that._socket.emit('getObjectView', 'system', 'device', {startkey: '', endkey: '\u9999'}, function (err, res) {
                            if (err) {
                                callback(err);
                                return;
                            }
                            var result = {};
                            for (var i = 0; i < res.rows.length; i++) {
                                data[res.rows[i].id] = res.rows[i].value;
                            }

                            if (that._useStorage) {
                                that._fillChildren(data);
                                that._objects = data;
                                that._enums   = enums;

                                if (typeof storage !== 'undefined') {
                                    storage.set('objects',  data);
                                    storage.set('enums',    enums);
                                    storage.set('timeSync', (new Date()).getTime());
                                }
                            }

                            if (callback) callback(err, data);
                        });
                    });
                });
            });
        });
    };
servConn.prototype.getChildren = function (id, useCache, callback) {
        if (!this._checkConnection('getChildren', arguments)) return;

        if (typeof id === 'function') {
            callback = id;
            id = null;
            useCache = false;
        }
        if (typeof id === 'boolean') {
            callback = useCache;
            useCache = id;
            id = null;
        }
        if (typeof useCache === 'function') {
            callback = useCache;
            useCache = false;
        }

        if (!id) return callback('getChildren: no id given');

        var that = this;
        var data = [];

        if (this._useStorage && useCache) {
            if (typeof storage !== 'undefined') {
                var objects = storage.get('objects');
                if (objects && objects[id] && objects[id].children) {
                    return callback(null, objects[id].children);
                }
            } else if (this._objects && this._objects[id] && this._objects[id].children) {
                return callback(null, this._objects[id].children);
            }
        }

        // Read all devices
        that._socket.emit('getObjectView', 'system', 'device', {startkey: id + '.', endkey: id + '.\u9999'}, function (err, res) {
            if (err) {
                callback(err);
                return;
            }
            var result = {};
            for (var i = 0; i < res.rows.length; i++) {
                data[res.rows[i].id] = res.rows[i].value;
            }

            that._socket.emit('getObjectView', 'system', 'channel', {startkey: id + '.', endkey: id + '.\u9999'}, function (err, res) {
                if (err) {
                    callback(err);
                    return;
                }
                var result = {};
                for (var i = 0; i < res.rows.length; i++) {
                    data[res.rows[i].id] = res.rows[i].value;
                }

                // Read all adapters for images
                that._socket.emit('getObjectView', 'system', 'state', {startkey: id + '.', endkey: id + '.\u9999'}, function (err, res) {
                    if (err) {
                        callback(err);
                        return;
                    }
                    var result = {};
                    for (var i = 0; i < res.rows.length; i++) {
                        data[res.rows[i].id] = res.rows[i].value;
                    }
                    var list = [];

                    var count = id.split('.').length;

                    // find direct children
                    for (var _id in data) {
                        var parts = _id.split('.');
                        if (count + 1 === parts.length) {
                            list.push(_id);
                        }
                    }
                    list.sort();

                    if (this._useStorage && typeof storage !== 'undefined') {
                        var objects = storage.get('objects') || {};

                        for (var id_ in data) {
                            objects[id_] = data[id_];
                        }
                        if (objects[id] && objects[id].common) {
                            objects[id].children = list;
                        }
                        // Store for every element theirs children
                        var items = [];
                        for (var __id in data) {
                            items.push(__id);
                        }
                        items.sort();

                        for (var k = 0; k < items.length; k++) {
                            if (objects[items[k]].common) {
                                var j = k + 1;
                                var children = [];
                                var len  = items[k].length + 1;
                                var name = items[k] + '.';
                                while (j < items.length && items[j].substring(0, len) === name) {
                                    children.push(items[j++]);
                                }

                                objects[items[k]].children = children;
                            }
                        }

                        storage.set('objects', objects);
                    }

                    if (callback) callback(err, list);
                }.bind(this));
            }.bind(this));
        }.bind(this));
    };
servConn.prototype.getObject = function (id, useCache, callback) {
        if (typeof id === 'function') {
            callback = id;
            id = null;
            useCache = false;
        }
        if (typeof id === 'boolean') {
            callback = useCache;
            useCache = id;
            id = null;
        }
        if (typeof useCache === 'function') {
            callback = useCache;
            useCache = false;
        }
        if (!id) return callback('no id given');

        // If cache used
        if (this._useStorage && useCache && typeof storage !== 'undefined') {
            if (typeof storage !== 'undefined') {
                var objects = this._objects || storage.get('objects');
                if (objects && objects[id]) return callback(null, objects[id]);
            } else if (this._enums) {
                return callback(null, this._enums);
            }
        }

        this._socket.emit('getObject', id, function (err, obj) {
            if (err) {
                callback(err);
                return;
            }
            if (this._useStorage && typeof storage !== 'undefined') {
                var objects = storage.get('objects') || {};
                objects[id] = obj;
                storage.set('objects', objects);
            }
            return callback(null, obj);
        }.bind(this));
    };
servConn.prototype.logError = function (errorText) {
        console.log("Error: " + errorText);
        if (!this._isConnected) {
            //console.log('No connection!');
            return;
        }
        //socket.io
        if (this._socket === null) {
            console.log('socket.io not initialized');
            return;
        }
        this._socket.emit('log', 'error', 'Addon DashUI  ' + errorText);
    };
servConn.prototype._queueCmdIfRequired = function (func, args) {
        var that = this;
        if (!this._isAuthDone) {
            // Queue command
            this._cmdQueue.push({func: func, args: args});

            if (!this._authRunning) {
                this._authRunning = true;
                // Try to read version
                this._checkAuth(function (version) {
                    // If we have got version string, so there is no authentication, or we are authenticated
                    that._authRunning = false;
                    if (version) {
                        that._isAuthDone  = true;
                        // Repeat all stored requests
                        var __cmdQueue = that._cmdQueue;
                        // Trigger GC
                        that._cmdQueue = null;
                        that._cmdQueue = [];
                        for (var t = 0, len = __cmdQueue.length; t < len; t++) {
                            that[__cmdQueue[t].func].apply(that, __cmdQueue[t].args);
                        }
                    } else {
                        // Auth required
                        that._isAuthRequired = true;
                        // What for AuthRequest from server
                    }
                });
            }

            return true;
        } else {
            return false;
        }
    };
servConn.prototype._detectViews = function (projectDir, callback) {
    this.readDir('/' + this.namespace + '/' + projectDir, function (err, dirs) {
        // find vis-views.json
        for (var f = 0; f < dirs.length; f++) {
            if (dirs[f].file === 'vis-views.json' && (!dirs[f].acl || dirs[f].acl.read)) {
                return callback(err, {name: projectDir, readOnly: (dirs[f].acl && !dirs[f].acl.write), mode: dirs[f].acl ? dirs[f].acl.permissions : 0});
            }
        }
        callback(err);
    });
};

//Events

servConn.prototype.event_DeviceAdded = function (device) { console.log("Device Added: " + device.name + " " + device.uuid); };
servConn.prototype.event_DeviceRemoved = function (device) { console.log("Device Removed: " + device.name); };
//servConn.prototype.event_DeviceChanged = function (deviceUUID, changeGroup, changedField, oldValue, newValue, fullDeviceData) { console.log("Device Change Detected for " + fullDeviceData.name + "-" + changeGroup + " value of " + changedField + " from " + oldValue + " to " + newValue); };
servConn.prototype.event_ErrorOccurred = function (err) { console.log("General Error: " + err); };

module.exports = servConn;