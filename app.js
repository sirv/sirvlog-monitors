var path = require('path');
var _ = require('underscore');
var async = require('async');
var AWS = require('aws-sdk');
var crypto = require('crypto');
var email   = require("emailjs");

var configFile = path.resolve(__dirname, 'config.js');

var optimist = require('optimist')
    .usage('Usage: $0 [options]')
    .default('config', configFile);

var argv = optimist.argv;

if(argv.help || argv.h) {
    optimist.showHelp();
    return;
}

require("clim")(console, true);

var config = require(argv.config);

var sirvlog = require('sirvlog').createClient(config.sirvlog).on('error', function(err){
    //console.error(err);
});

Application = function(){
    this.monitors = [];
    this.alerts = []; // array of sent alerts (md5 + timestamp), to avoid sending them each config.checkInterval

    _.each(config.monitors, function(monitorConfig, monitorName){

        var monitor = require('./lib/'+monitorName).createMonitor(monitorConfig);

        monitor
            .on('data', function(data){
                _.defer(this.logData.bind(this), data, monitorName, monitorConfig);
            }.bind(this))
            .on('error', function(err){
                this.alert('MONITOR ALERT: ' + monitorName.toUpperCase() +': ' + err.message, JSON.stringify(err, null, '\t'));
                if(!err.custom) err.custom = {}
                sirvlog.alert(err.message, err.custom);
            }.bind(this));

        this.monitors.push(monitor);

    }.bind(this));

    this.emailServer  = email.server.connect({
        user:    config.notifications.username,
        password:   config.notifications.password,
        host:    config.notifications.server,
        port:    config.notifications.port,
        ssl:     config.notifications.ssl,
        tls:     config.notifications.tls
    });

    AWS.config.update(config.aws.credentials);

    this.sns = new AWS.SNS();
}

Application.prototype.run = function(){
    _.each(this.monitors, function(monitor){
        monitor.run();
    }.bind(this))
}

Application.prototype.logData = function (data, monitorName, monitorConfig) {

    var quote = function(str){ return '['+str+']' }

    _.each(data, function (info) {

        var service = info.name;

        if(info.hostname){
            service += '@' + info.hostname;
        }

        if(info.getStateLevel() < 5){

            this.alert('SERVICE ' + (info.getStateLevel()==4?'WARNING':'ALERT') + ': ' + service + ': STATUS: ' + info.getStateName(),
                JSON.stringify(info, null, '\t'),
                crypto.createHash('md5').update(service+info.state).digest("hex"));
        }

        console.log(quote(service) + ' ' + info.message);

        if(monitorConfig.log == true || monitorConfig.log === undefined){

            sirvlog._store({
                hostname: info.hostname,
                timestamp: Date.now(),
                facility: monitorName + '/' + info.name,
                level: info.getStateLevel(),
                message: info.message,
                custom: info.info
            });
        }
    }.bind(this))
}

Application.prototype.alert = function (subject, message, md5) {

    md5 = md5 || crypto.createHash('md5').update(subject + message).digest("hex");
    var ts = Date.now();

    console.log('ALERT: ' + subject + '\n' + message);

    if(_.find(this.alerts, function(obj){
       return (obj.md5 == md5) && (obj.ts > (ts - config.notifications.alertDelay*60*1000));
    })){
        console.log('Not sending notifications for this alert because it was sent less than ' + config.notifications.alertDelay +' minutes ago');
        return;
    }

    this.alerts.push({
        md5: md5,
        ts: ts
    });

    this.emailServer.send({
        text:    message,
        from:    config.notifications.from,
        to:      config.notifications.subscriptions.join(','),
        subject: subject
    }, function(err, msg) {
        if(err){
            console.error(err);

            if(config.aws.sns.arn){ // fallback to Amazon SNS
                this.sns.client.publish({
                    TopicArn: config.aws.sns.arn,
                    Message: message,
                    Subject: subject
                }, function(err, data){
                    if(err){
                        console.error(err);
                        return;
                    }

                    this.alerts.push({
                        md5: md5,
                        ts: ts
                    });

                    console.log('ALERT was sent with Amazon SNS: ' + JSON.stringify(data));
                }.bind(this))
            }

            return;
        }

        console.log('ALERT was sent with SMTP server ' + config.notifications.server);

    }.bind(this));


}

var app = new Application();

app.run();

setInterval(app.run.bind(app), 1000 * config.checksInterval);
