var _ = require('underscore');

exports.Monitor = Monitor = function(){}

Monitor.ProcessStates = {
    STOPPED: 0, // The process has been stopped due to a stop request or has never been started.
    STARTING: 10, // The process is starting due to a start request.
    RUNNING: 20, // The process is running.
    BACKOFF: 30, // The process entered the STARTING state but subsequently exited too quickly to move to the RUNNING state.
    STOPPING: 40, // The process is stopping due to a stop request.
    EXITED: 100, // The process exited from the RUNNING state (expectedly or unexpectedly).
    FATAL: 200, // The process could not be started successfully.
    FAILING: 299, // monitor has detected increased error level
    UNKNOWN: 1000 // The process is in an unknown state
}

Monitor.ProcessInfo = function(info){

    _.defaults(this, info, {
        state: Monitor.ProcessStates.UNKNOWN,
        hostname: null,
        name: '',
        exitStatus: 0,
        info: null
    });

    _.defaults(this, {
        message: 'STATUS: ' + this.getStateName()
    });
}

Monitor.ProcessInfo.prototype.getStateName = function(){
    var name = null;

    var f = _.find(Monitor.ProcessStates, function(val, key){
        if(this.state == val){
            name = key;
            return true;
        }
        return false;
    }.bind(this));

    return name;
}


// maps directly to Sirvlog levels
Monitor.ProcessInfo.prototype.getStateLevel = function(){
    switch (this.state) {
        case Monitor.ProcessStates.STOPPED:
            return 4; // warning
        case Monitor.ProcessStates.STARTING:
            return 5; //notice
        case Monitor.ProcessStates.RUNNING:
            return 6;
        case Monitor.ProcessStates.BACKOFF:
            if (this.exitStatus != 0) {
                return 2; // critical
            } else {
                return 4; // warning
            }
            break;
        case Monitor.ProcessStates.STOPPING:
            return 5; // notice
        case Monitor.ProcessStates.EXITED:
            if (this.exitStatus != 0) {
                return 2; // critical
            } else {
                return 4; // warning
            }
        case Monitor.ProcessStates.FATAL:
            return 1; // alert
        case Monitor.ProcessStates.FAILING:
            return 3; // error
        case Monitor.ProcessStates.UNKNOWN:
            return 1; // alert
    }

    return 3;
}

/*
Monitor.STOPPED_STATES = [
    Monitor.ProcessStates.STOPPED,
    Monitor.ProcessStates.EXITED,
    Monitor.ProcessStates.FATAL,
    Monitor.ProcessStates.UNKNOWN
];

Monitor.RUNNING_STATES = [
    Monitor.ProcessStates.RUNNING,
    Monitor.ProcessStates.BACKOFF,
    Monitor.ProcessStates.STARTING
];

*/