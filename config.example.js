module.exports = {

    aws: {
        credentials: {
            "accessKeyId": "AAAAAAAAAAAAAAAAAAAA",
            "secretAccessKey": "BBBBBBBBBBBBBBBB",
            "region": "us-east-1"
        },
        sns: {
            arn: "arn:aws:sns:us-east-1:9999999999999:Health_alert" // will be used as fallback for email notifications if SMTP delivery fails
        }
    },

    notifications: {
        alertDelay: 10, // dont sent the same (identical) alarms more than once within this amount of minutes
        email: {
            server: "email-smtp.us-east-1.amazonaws.com",
            port: 587,
            username: "AAAAAAAAAAAAA",
            password: "BBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
            from: "\"Health Monitor\" <monitor@organisation.com>",
            ssl: false,
            tls: true,
            subscriptions: [
                'admin@gmail.com',
                'developer@gmail.com'
            ]
        },
        pushover: {
            api_token: 'AAAAAAAAAAAAA', // application API token
            priority: 1, //  send as -1 to always send as a quiet notification, 1 to display as high-priority and bypass the user's quiet hours, or 2 to also require confirmation from the user
            sound: 'alien', // sound
            subscriptions: [ // user keys
                'UUUUUUUUUUUUU'
            ]

        }
    },

    sirvlog: {
        'facility': 'healthmonitor',
        'server': {
            'address': '127.0.0.1',
            'port': 12514
        }
    },

    monitors: {
        supervisor: {
            log: true,
            hosts: [
                {
                    host: 'localhost',
                    noConnectionErrors: true, // don't log (and don't send alerts) if we can't connect to this host (usefull if this host is temporary)
                    port: 9001,
                    path: '/RPC2/'
                }
            ],
            // map required process name with supervisor full process_name, which is usualy {group}:{name}{num}
            // the key is replacement and the value is regular expression pattern
            processNameMap:{
                '$1': /^sirvlog:(.+?):(\d+)$/
                //'sirv-workers/$1': /^sirv-workers:(.+?):.+$/
            }
        },
        loganalyzer: {
            log: false,
            elasticsearch: {
                hostname: '127.0.0.1',
                index: 'sirvlog*',
                options: {
                    port: 9200,
                    protocol: 'http',
                    timeout: 60000
                }
            },
            webserver: "https://log.organisation.com", // http endpoint of the sirvlog web frontend (https://github.com/magictoolbox/sirvlog-web)
            // exclude query filters,
            // each object defined in this array is mapped as value to 'query' key:
            // http://www.elasticsearch.org/guide/reference/query-dsl/query-filter.html
            exclude: [
                {
                    "field": {
                        "facility": "\"auth/sudo\" clock \"kernel/kernel\" \"daemon/acpid\""
                    }
                }
            ]
        }
    },

    checksInterval: 60 // in seconds

}
