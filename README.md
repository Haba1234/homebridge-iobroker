# homebridge-iobroker

Iobroker plugin for homebridge

In developing!

# Installation

1. Install homebridge using: npm install -g homebridge
2. Install homebridge-iobroker using: npm install -g homebridge-iobroker or npm install -g https://github.com/Haba1234/homebridge-iobroker/tarball/master
3. Update your configuration file. 

# Configuration

Example file */root/.homebridge/config.json*

```
{
    "bridge": {
        "name": "Homebridge",
        "username": "CC:22:3D:E3:CE:35",
        "port": 51826,
        "pin": "000-00-000"
    },
    "description": "Config file with just iobroker",
    "platforms": [
        {
            "platform" : "homebridge-iobroker.iobroker",
            "name" : "iobroker",
            "host": "http://localhost:8084",
            "ID": "javascript.0.Signalka.battery"
        }
    ]   
}
```

# ToDo

Soon....
