/* Load necessary modules */
var cluster = require('cluster');
var Collective = require('collective');
var express = require('express');
var bodyParser = require('body-parser');

/* Config. Edit to suit your needs */
var cpu_count = require('os').cpus().length; // A good practice to use all of availabe processors. 
var hosts = [
  '192.168.1.105',
  '192.168.1.50'
]; // Depends on how many servers you have. 

var localhost = hosts[0]; // Select a proper host from hosts pool for the current server. 
var port = 7000; // Starting port. Arbitrary, really.

/**
 *  Populate with all possible hosts based on cpu count. WARNING: This will not work if your servers
 *  have different cpu counts. If that's the case - create all_hosts array manually.
 */
var all_hosts = [];
for (var i = 0; i < hosts.length; i++) {
  for (var j = 0; j < cpu_count; j++) {
    all_hosts.push({host: hosts[i], port: port + j});
  }
}

/* Bootup cluster */
if (true === cluster.isMaster) {
  /* Additional mapping is required in order to preserve worker ids when they are restarted. */
  var map = {};

  function forkWorker(worker_id) {
    var worker = cluster.fork({worker_id: worker_id});

    map[worker.id] = worker_id;
  }

  for (var i = 0; i < cpu_count; i++) {
    forkWorker(i);
  }

  /* You should do some error logging here (left out for the sake of simplicity) */
  cluster.on('exit', function (worker, code, signal) {
    var old_worker_id = map[worker.id];

    console.log('worker exit: ' + old_worker_id);

    delete map[worker.id];

    forkWorker(old_worker_id);
  });
} else {
  /* Set a local host and a port for collective to use. Based on worker id. */
  var local = {host: localhost, port: port + parseInt(process.env.worker_id, 10)};

  /* Start collective. */
  var collective = new Collective(local, all_hosts, function (collective) {
    /**
     *  All done! This is where you start your normal coding. Lines below are just a
     *  demonstration of collective.js set/increment/delete synchronization capabilities.
     */

    collective.set('waldo', 0);


    var app = express();
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: false }));

    var expressPort = collective.local.port - 1000;

    app.get('/waldo', function(req, res){
      res.json('Waldo is ' + collective.get('waldo'));
    });

    app.get('/hosts', function(req, res){
      res.json(all_hosts);
    });

    app.get('/update', function(req, res){
      collective.set('waldo', 1, collective.OPERATIONS.INCREMENT);
      res.json('Waldo is ' + collective.get('waldo'));
    });

    app.listen(expressPort);

    console.log('Hey, I am ' + collective.local.host + ':' + collective.local.port +
    ' and my webserver is listening on port ' + expressPort);

    //collective.set('over.nine.thousand', 9000, collective.OPERATIONS.INCREMENT);
    //collective.set('over.nine.thousand', null, collective.OPERATIONS.DELETE);

  });
}
