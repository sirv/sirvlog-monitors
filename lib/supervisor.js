var util = require("util");
var events = require("events");
var xmlrpc = require('xmlrpc')
var _ = require('underscore');
var async = require('async');
var Monitor = require('./monitor').Monitor;


exports.SupervisorMonitor = SupervisorMonitor = function(config){

    this.config = config;

}

util.inherits(SupervisorMonitor, events.EventEmitter);

exports.createMonitor = function (config) {
    return new SupervisorMonitor(config);
};

SupervisorMonitor.prototype.formatResponse = function (raw, host) {
    var res = [], processName;

    _.each(raw, function(info){

        processName = info.group + ':' + info.name;

        if(info.group == info.name){
            processName = info.name;
        }

        _.find(this.config.processNameMap, function(pattern, replacement){
            if(pattern.test(processName)){
                processName = processName.replace(pattern, replacement);
                return true;
            }
            return false;
        });

        res.push(new Monitor.ProcessInfo({
            name: processName,
            state: info.state,
            exitStatus: info.exitstatus,
            message: 'STATUS: ' + info.statename + ', ' + info.description,
            hostname: host.host,
            info: {
                pid: info.pid,
                stop: info.stop,
                spawnerr: info.spawnerr,
                now: info.now,
                group: info.group,
                name: info.name,
                statename: info.statename,
                start: info.start,
                monitor: 'supervisor'
            }
        }));

    }.bind(this))

    return res;
}

SupervisorMonitor.prototype.run = function () {
    async.parallel(_.map(this.config.hosts, function (host) {
        return function (cb) {
            var client = xmlrpc.createClient(host)

            client.methodCall('supervisor.getAllProcessInfo', [], function (err, response) {
                if(err){
                    err.message = 'supervisor@' + host.host + ': ' + err.message;
                    if(!host.noConnectionErrors){ // don't emit this error up so that we don't send alert
                        err.custom = host;
                        this.emit('error', err);
                    } else { //just log it
                        console.log(err);
                    }
                    cb(null, []);
                    return;
                }
                // Results of the method response
                //console.log('Method response: ', response);
                cb(null, this.formatResponse(response, host));
            }.bind(this));

        }.bind(this);
    }.bind(this)),
        function (err, data) {
            this.emit('data', _.flatten(data, true));
        }.bind(this)
    );
}


