# homebridge-iobroker

Iobroker plugin for homebridge

In developing!

# Installation

1. Install homebridge using: **npm install -g homebridge**
2. Install homebridge-iobroker using: **npm install -g https://github.com/Haba1234/homebridge-iobroker/tarball/master**
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
            "filter": "*",
            "switches": [
                "adapter.0.object_1",
                "adapter.0.object_2",
                "adapter.0.object_3",
                ...
             ]
        }
    ]
}
```

Параметр **filter** дает возможность задать фильтр на подписку изменений состояний объектов. 
Например: 
**"*"** - ловить все изменения состояний, 
**"javascript.0.*"** - ловить измениния состояний по объектам ветки адаптера *javascript.0.*

В параметре **"switches"** задаем перечень объектов-выключателей, которые будут отображаться в **homekit**.
Значения будут записываться вида **true/false**, например:
```
"switches": [
    "javascript.0.test1",
    "javascript.0.test2",
    "javascript.0.test3"
]
```

# ToDo

Soon....
