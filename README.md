# sirvlog-monitors

Monitors your whole Application health by periodically checking:

  * Status of services controlled by [supervisord](http://supervisord.org/) (via XML-RPC)
  * logs saved by [sirvlog](https://github.com/sirv/sirvlog) server 
  
Will immediately send an ALERT (by email, push to Amazon SNS topic or using [Pushover](http://pushover.net) ) if there are any problems or errors

### How does it work?

The application currently consists of two monitors: supervisor and loganalyzer. 

The first one, supervisor, periodically (oncer per minute) connects to configured hosts running [supervisord](http://supervisord.org/)
(make sure your supervisord is configured to accepts XML-RPC connections) and verifies the status of all services running on this supervisor node.
If any of the services is in FATAL, FAILING, e.g in any "broken" status it will immediately send an alert according to subscription configuration using configured [Pushover](http://pushover.net) setup, SMTP server (Amazon SMTP in example), or Amazon SNS if the smtp delivery fails.

The second one, loganalyzer, periodically connects to the same ElasticSearch server that your [sirvlog](https://github.com/sirv/sirvlog) server stores its messages and if it founds that there were any errors (fatal, critical, error) it will immediately send an alert email the same way supervisor monitor does. Of course you can filter out errors thats you are not interested in (see loganalyzer.exclude config option).

### Running as [supervisord](http://supervisord.org/) service

[supervisord](http://supervisord.org/) is a great tool to run your Node apps as it allows you to have full control over running services.

So the typical config will be

``` sh
$ cat /etc/supervisor.d/sirvlog-monitors.conf 
```

``` sh
[program:sirvlog-monitors]
command=/home/nvm/v0.10.2/bin/node /home/sirvlog-monitors/src/app.js --config /home/sirvlog-monitors/config.js
process_name=sirvlog-monitors
numprocs=1
numprocs_start=0
autostart=true
autorestart=true
startsecs=1
startretries=3
exitcodes=0,2
stopsignal=TERM
stopwaitsecs=10
user=www-data
redirect_stderr=true
stdout_logfile=/home/sirvlog-monitors/logs/sirvlog-monitors.log
stdout_logfile_maxbytes=50MB
stdout_logfile_backups=10
stdout_capture_maxbytes=0
stdout_events_enabled=false
stderr_logfile=AUTO
stderr_logfile_maxbytes=50MB
stderr_logfile_backups=10
stderr_capture_maxbytes=0
stderr_events_enabled=false
serverurl=AUTO
```


### See also

  * [sirvlog](https://github.com/sirv/sirvlog)
  * [sirvlog web frontend](https://github.com/sirv/sirvlog-web)
  * [log parser for sirvlog](https://github.com/sirv/sirvlog-parser)

## Authors

**Oleksiy Krivoshey**

  * [https://github.com/oleksiyk](https://github.com/oleksiyk)

# License (MIT)

Copyright (c) 2013 Sirv.

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.

