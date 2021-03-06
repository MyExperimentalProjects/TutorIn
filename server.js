#!/bin/env node
//  OpenShift sample Node application
var express = require('express');
var mongojs = require('mongojs');
var fs      = require('fs');
var db = require("./db.js"); 
var bodyParser = require('body-parser');
var ObjectId = mongojs.ObjectId;
var cors = require('cors')

/**
 *  Define the sample application.
 */
var SampleApp = function() {

    //  Scope.
    var self = this;


    /*  ================================================================  */
    /*  Helper functions.                                                 */
    /*  ================================================================  */

    /**
     *  Set up server IP address and port # using env variables/defaults.
     */
    self.setupVariables = function() {
        //  Set the environment variables we need.
        self.ipaddress = process.env.OPENSHIFT_NODEJS_IP;
        self.port      = process.env.OPENSHIFT_NODEJS_PORT || 8080;

        if (typeof self.ipaddress === "undefined") {
            //  Log errors on OpenShift but continue w/ 127.0.0.1 - this
            //  allows us to run/test the app locally.
            console.warn('No OPENSHIFT_NODEJS_IP var, using 127.0.0.1');
            self.ipaddress = "127.0.0.1";
        };
    };


    /**
     *  Populate the cache.
     */
    self.populateCache = function() {
        if (typeof self.zcache === "undefined") {
            self.zcache = { 'index.html': '' };
        }

        //  Local cache for static content.
        self.zcache['index.html'] = fs.readFileSync('./index.html');
    };


    /**
     *  Retrieve entry (content) from cache.
     *  @param {string} key  Key identifying content to retrieve from cache.
     */
    self.cache_get = function(key) { return self.zcache[key]; };


    /**
     *  terminator === the termination handler
     *  Terminate server on receipt of the specified signal.
     *  @param {string} sig  Signal to terminate on.
     */
    self.terminator = function(sig){
        if (typeof sig === "string") {
           console.log('%s: Received %s - terminating sample app ...',
                       Date(Date.now()), sig);
           process.exit(1);
        }
        console.log('%s: Node server stopped.', Date(Date.now()) );
    };


    /**
     *  Setup termination handlers (for exit and a list of signals).
     */
    self.setupTerminationHandlers = function(){
        //  Process on exit and signals.
        process.on('exit', function() { self.terminator(); });

        // Removed 'SIGPIPE' from the list - bugz 852598.
        ['SIGHUP', 'SIGINT', 'SIGQUIT', 'SIGILL', 'SIGTRAP', 'SIGABRT',
         'SIGBUS', 'SIGFPE', 'SIGUSR1', 'SIGSEGV', 'SIGUSR2', 'SIGTERM'
        ].forEach(function(element, index, array) {
            process.on(element, function() { self.terminator(element); });
        });
    };


    /*  ================================================================  */
    /*  App server functions (main app logic here).                       */
    /*  ================================================================  */

    /**
     *  Create the routing table entries + handlers for the application.
     */
    self.createRoutes = function() {
        self.routes = { };
        self.postroutes = { };

        self.routes['/asciimo'] = function(req, res) {
            var link = "http://i.imgur.com/kmbjB.png";
            res.send("<html><body><img src='" + link + "'></body></html>");
        };

        self.routes['/'] = function(req, res) {
            res.setHeader('Content-Type', 'text/html');
            res.send(self.cache_get('index.html') );
        };

        self.routes['/get/tutors'] = function(req, res) {
            res.setHeader('Content-Type', 'application/json');
            var user = db.collection('user');
            var filter = {"isTutor": true};
            if(req.param('state')){
                filter["location.state"] = req.param('state');
            }
            if(req.param('country')){
                filter["location.country"] = req.param('country');
            }
            if(req.param('city')){
                filter["location.city"] = req.param('city');
            }
            if(req.param('area')){
                filter["location.area"] = req.param('area');
            }

            if(req.param('pref')){
                filter["pref.tutor"] = { $in: [req.param('pref')] }
            }

            if(req.param('day')){
                filter["availability.tutor"] = { $elemMatch: { "day": req.param('day')} }
            }
        
            db.user.find(filter, function(err, docs) {
                res.send(docs);
            }); 
            
        };

        self.routes['/get/categories'] = function(req, res) {
            res.setHeader('Content-Type', 'application/json');
            var category = db.collection('category');
            db.category.find({}, function(err, docs) {
                res.send(docs);
            }); 
            
        };

        self.routes['/get/tutor/:id'] = function(req, res) {
            res.setHeader('Content-Type', 'application/json');
            var user = db.collection('user');
            db.user.findOne({"_id":ObjectId(req.param('id'))}, function(err, docs) {
                res.send(docs);
            }); 
            
        };

        self.postroutes['/post/user'] = function(req, res) {
            res.setHeader('Content-Type', 'application/json');
            var user = db.collection('user');
            var params = req.body;

            db.user.findOne({"uid":params.uid}, function(err, docs) {
                if(err){
                    res.send(err);
                }else{
                    if(!docs || docs.length == 0){
                        db.user.save(params, function(err, docs) {
                            res.send(docs);
                        });
                    }else{
                        docs["exists"] = true;
                        res.send(docs);   
                    }
                }
            });
            
        };

        self.postroutes['/post/session'] = function(req, res) {
            res.setHeader('Content-Type', 'application/json');
            var session = db.collection('session');
            var params = req.body;

            db.session.save(params, function(err, docs) {
                if(err){
                    res.send(err);
                }else{
                    res.send(docs);
                }
            });        
        };

        self.postroutes['/post/session/:id'] = function(req, res) {
            res.setHeader('Content-Type', 'application/json');
            var session = db.collection('session');
            var params = req.body;
            db.session.update({"_id":ObjectId(req.param('id'))}, params, {upsert: false}, function(err, docs) {
                if(err){
                    res.send(err);
                    return;
                }
                res.send(docs);
            });        
        };

        self.routes['/get/session/:id'] = function(req, res) {
            res.setHeader('Content-Type', 'application/json');
            var session = db.collection('session');

            db.session.findOne({"_id":ObjectId(req.param('id'))}, function(err, docs) {
                if(err){
                    res.send(err);
                }else{
                    res.send(docs);
                }
            });        
        };

        self.postroutes['/post/user/:id'] = function(req, res) {
            res.setHeader('Content-Type', 'application/json');
            var user = db.collection('user');
            var params = req.body;
            //console.log(params);
            db.user.update({"_id":ObjectId(req.param('id'))}, params, {upsert: false}, function(err, docs) {
                if(err){
                    res.send(err);
                    return;
                }
                res.send(docs);
            });
            
        };

        self.postroutes['/post/tutor/:id/pref'] = function(req, res) {
            res.setHeader('Content-Type', 'application/json');
            var user = db.collection('user');
            var params = req.body;
            db.user.update({"_id":ObjectId(req.param('id'))}, { $set: {"pref.tutor" :params}}, {upsert: false}, function(err, docs) {
                if(err){
                    res.send(err);
                    return;
                }
                res.send(docs);
            });
        };

        self.postroutes['/post/tutor/:id/rating'] = function(req, res) {
            res.setHeader('Content-Type', 'application/json');
            var user = db.collection('user');
            var params = req.body;
            db.user.update({"_id":ObjectId(req.param('id'))}, { $set: {"rating.tutor" :params.rating}}, {upsert: false}, function(err, docs) {
                if(err){
                    res.send(err);
                    return;
                }
                res.send(docs);
            });
        };

        self.postroutes['/post/tutor/:id/availability'] = function(req, res) {
            res.setHeader('Content-Type', 'application/json');
            var user = db.collection('user');
            var params = req.body;
            db.user.update({"_id":ObjectId(req.param('id'))}, { $set: {"availability.tutor" :params}}, {upsert: false}, function(err, docs) {
                if(err){
                    res.send(err);
                    return;
                }
                res.send(docs);
            });
        };

        self.postroutes['/post/tutee/:id/pref'] = function(req, res) {
            res.setHeader('Content-Type', 'application/json');
            var user = db.collection('user');
            var params = req.body;
            db.user.update({"_id":ObjectId(req.param('id'))}, { $set: {"pref.tutee":params}}, {upsert: false}, function(err, docs) {
                if(err){
                    res.send(err);
                    return;
                }
                res.send(docs);
            });          
        };

        self.postroutes['/post/tutee/:id/rating'] = function(req, res) {
            res.setHeader('Content-Type', 'application/json');
            var user = db.collection('user');
            var params = req.body;
            db.user.update({"_id":ObjectId(req.param('id'))}, { $set: {"rating.tutee":params.rating}}, {upsert: false}, function(err, docs) {
                if(err){
                    res.send(err);
                    return;
                }
                res.send(docs);
            });          
        };

        self.postroutes['/post/tutee/:id/availability'] = function(req, res) {
            res.setHeader('Content-Type', 'application/json');
            var user = db.collection('user');
            var params = req.body;
            db.user.update({"_id":ObjectId(req.param('id'))}, { $set: {"availability.tutee" :params}}, {upsert: false}, function(err, docs) {
                if(err){
                    res.send(err);
                    return;
                }
                res.send(docs);
            });
        };

        self.routes['/get/user/:id'] = function(req, res) {
            res.setHeader('Content-Type', 'application/json');
            var user = db.collection('user');
            db.user.findOne({"_id":ObjectId(req.param('id'))}, function(err, docs) {
                res.send(docs);
            });          
        };

        self.routes['/get/tutor/:id/sessions'] = function(req, res) {
            res.setHeader('Content-Type', 'application/json');
            var session = db.collection('session');
            db.session.find({"tutor_id":req.param('id')}, function(err, docs) {
                res.send(docs);
            });          
        };

        self.routes['/get/tutee/:id/sessions'] = function(req, res) {
            res.setHeader('Content-Type', 'application/json');
            var user = db.collection('user');
            db.session.find({"tutee_id":req.param('id')}, function(err, docs) {
                res.send(docs);
            });           
        };

        self.routes['/get/tutee/:id/pref'] = function(req, res) {
            res.setHeader('Content-Type', 'application/json');
            var user = db.collection('user');
            var filter = {"isTutor": false};
            db.user.findOne({"_id":ObjectId(req.param('id'))}, {"pref.tutee":true}, function(err, docs) {
                if(err){
                    res.send([]);
                    return;
                }
                if(docs.length == 0 || !docs.pref){
                    res.send([]);
                    return;
                }
                var objectIds = docs.pref.tutee.map(function(x) {
                   return ObjectId(x);
                });
                //console.log(objectIds);
                db.category.find({ "_id": { $in: objectIds } }, function(err, prefs){
                    res.send(prefs);
                });
            });          
        };

        self.routes['/get/tutor/:id/pref'] = function(req, res) {
            res.setHeader('Content-Type', 'application/json');
            var user = db.collection('user');
            var filter = {"isTutor": true};
            db.user.findOne({"_id":ObjectId(req.param('id'))}, {"pref.tutor":true}, function(err, docs) {
                if(err){
                    res.send([]);
                    return;
                }
                if(docs.length == 0 || !docs.pref){
                    res.send([]);
                    return;
                }
                var objectIds = docs.pref.tutor.map(function(x) {
                   return ObjectId(x);
                });
                //console.log(objectIds);
                db.category.find({ "_id": { $in: objectIds } }, function(err, prefs){
                    res.send(prefs);
                });
            });             
        };

        self.routes['/get/tutee/:id'] = function(req, res) {
            res.setHeader('Content-Type', 'application/json');
            var user = db.collection('user');
            db.user.find({"_id":ObjectId(req.param('id'))}, function(err, docs) {
                res.send(docs);
            });          
        };


        self.routes['/get/tutees'] = function(req, res) {
            res.setHeader('Content-Type', 'application/json');
            var user = db.collection('user');
            var filter = {"isTutor": false};
            console.log(req.param('state'));
            if(req.param('state')){
                filter["location.state"] = req.param('state');
            }
            if(req.param('country')){
                filter["location.country"] = req.param('country');
            }
            if(req.param('city')){
                filter["location.city"] = req.param('city');
            }
            if(req.param('area')){
                filter["location.area"] = req.param('area');
            }
            if(req.param('pref')){
                filter["pref.tutee"] = { $in: [ObjectId(req.param('pref'))] }
            }

            if(req.param('day')){
                filter["availability.tutee"] = { $elemMatch: { "day": req.param('day')} }
            }
    
            db.user.find(filter, function(err, docs) {
                res.send(docs);
            }); 
            
        };
    };


    /**
     *  Initialize the server (express) and create the routes and register
     *  the handlers.
     */
    self.initializeServer = function() {
        self.createRoutes();
        self.app = express();
        

        self.app.use(function(req, res, next) {
          res.header("Access-Control-Allow-Origin", "*");
          res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
          next();
        });

        //self.app.use(cors());

        //  Add handlers for the app (from the routes).
        self.app.use(bodyParser.json()); // support json encoded bodies
        self.app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies
        for (var r in self.routes) {
            self.app.get(r, self.routes[r]);
        }
        for (var r in self.postroutes) {
            self.app.post(r, self.postroutes[r]);
        }
    };


    /**
     *  Initializes the sample application.
     */
    self.initialize = function() {
        self.setupVariables();
        self.populateCache();
        self.setupTerminationHandlers();

        // Create the express server and routes.
        self.initializeServer();
    };


    /**
     *  Start the server (starts up the sample application).
     */
    self.start = function() {
        //  Start the app on the specific interface (and port).
        self.app.listen(self.port, self.ipaddress, function() {
            console.log('%s: Node server started on %s:%d ...',
                        Date(Date.now() ), self.ipaddress, self.port);
        });
    };

};   /*  Sample Application.  */



/**
 *  main():  Main code.
 */
var zapp = new SampleApp();
zapp.initialize();
zapp.start();

