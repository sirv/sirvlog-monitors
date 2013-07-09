var path = require('path');
var _ = require('underscore');
var async = require('async');
var AWS = require('aws-sdk');
var crypto = require('crypto');
var email   = require("emailjs");
var request = require('request');

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

    this.emailServer = null;
    this.sns = null;

    if(config.notifications){

        if(config.notifications.email){
            this.emailServer  = email.server.connect({
                user:    config.notifications.email.username,
                password:   config.notifications.email.password,
                host:    config.notifications.email.server,
                port:    config.notifications.email.port,
                ssl:     config.notifications.email.ssl,
                tls:     config.notifications.email.tls
            });
        }

        if(config.notifications.sns){
            AWS.config.update(config.notifications.sns);
            this.sns = new AWS.SNS();
        }
    }
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

    _.each(config.notifications.subscriptions, function(subscription){
        async.series(
            _.map(subscription, function(target){
                var matches = target.match(/^(pushover|email|sns):\/\/(.*)$/)
                if(matches){

                    return function(cb){
                        this[matches[1] + 'Alert'].call(this, matches[2], message, subject, function(err){
                            // reverse the meaning of error
                            if(err){
                                console.error('[' + matches[1].toUpperCase() + ']: ', err);
                                cb(null);
                            } else {
                                cb('ALERT was sent with _' + matches[1] + '_ protocol to ' + matches[2]);
                            }
                        })
                    }.bind(this)
                } else {
                    console.error('Don\'t know what to do with', target);
                    return null;
                }
            }.bind(this))
        , function(err, result){
            if(err) {
                console.log(err);
            } else {
                console.error('Failed to send ALERT with all configured methods!')
            }
        })
    }.bind(this))

}


Application.prototype.emailAlert = function(email, message, subject, cb){
    if(!this.emailServer){
        cb('Email server is not configured')
        return;
    }

    this.emailServer.send({
        text:    message,
        from:    config.notifications.email.from,
        to:      email,
        subject: subject
    }, function(err, msg) {
        if(err){
            cb(err);
        } else {
            cb(null);
        }

    }.bind(this));
}

Application.prototype.snsAlert = function(topic, message, subject, cb){

    if(!this.sns){
        cb('SNS is not configured')
        return;
    }

    this.sns.client.publish({
        TopicArn: topic,
        Message: message,
        Subject: subject
    }, function(err, data){
        if(err){
            cb(err);
        } else {
            cb(null);
        }
    }.bind(this))
}

Application.prototype.pushoverAlert = function(user, message, subject, cb){

    if(!config.notifications.pushover){
        cb('Pushover is not configured');
        return;
    }

    request({
        url: 'https://api.pushover.net/1/messages.json',
        method: 'POST',
        form: {
            token: config.notifications.pushover.api_token,
            user: user,
            message: message,
            title: subject,
            priority: config.notifications.pushover.priority || 0,
            sound: config.notifications.pushover.sound || 'pushover'
        }
    }, function(err, res, body){

        if(err){
            cb(err);
        } else if(res.statusCode != 200) {
            cb(body);
        } else {
            cb(null);
        }
    })

}

var app = new Application();

app.alert('test subject', 'test message');

//app.run();

//setInterval(app.run.bind(app), 1000 * config.checksInterval);
