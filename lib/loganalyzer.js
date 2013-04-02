var util = require("util");
var events = require("events");
var _ = require('underscore');
var async = require('async');
var Monitor = require('./monitor').Monitor;

var elastical = require('elastical');


exports.LogAnalyzerMonitor = LogAnalyzerMonitor = function(config){

    this.config = config;

    this.elasticClient = new elastical.Client(config.elasticsearch.hostname, config.elasticsearch.options);

    this.tsSince = Date.now();

}

util.inherits(LogAnalyzerMonitor, events.EventEmitter);

exports.createMonitor = function (config) {
    return new LogAnalyzerMonitor(config);
};

LogAnalyzerMonitor.prototype.run = function () {

    var tsTo = Date.now();
    var filters = [];

    filters.push({
        "range": {
            "receivedTs": {
                "gt": this.tsSince,
                "lte": tsTo
            }
        }
    });

    filters.push({
        "range": {
            "level": {
                "lt": 4
            }
        }
    });

    _.each(this.config.exclude, function(query){
        filters.push({
            "not": {
                "query": query
            }
        });
    })

    this.elasticClient.search({
        index: this.config.elasticsearch.index,
        "query": {
            "filtered":{
                "query": {
                    "match_all": {}
                },
                "filter":{
                    "and": filters
                }
            }
        },
        "sort":[
            {
                "timestamp": "desc"
            }
        ]
    }, function(err, res, full){
        if(err){
            err.custom = err.message;
            err.message = 'loganalyzer monitor: elasticsearch error';
            this.emit('error', err);
            return;
        }

        this.tsSince = tsTo;

        var data = _.map(full.hits.hits, function(hit){

            return new Monitor.ProcessInfo({
                name: hit._source.facility,
                hostname: hit._source.hostname,
                state: Monitor.ProcessStates.FAILING,
                message: hit._source.message,
                datetime: (new Date(hit._source.timestamp)).toString(),
                link: this.config.webserver + '/#/message/' + hit._index + '/' + hit._id,
                info: hit._source
            })

        }.bind(this));

        if(data.length) this.emit('data', data);

    }.bind(this));
}

