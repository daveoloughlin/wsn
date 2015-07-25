var restify=require('restify');
var pg = require('pg');
var bunyan = require('bunyan');

var logger = new bunyan({
  name: 'api',
  streams: [
    {
      stream: process.stdout,
      level: 'debug'
    },
    {
      path: 'apiTrace.log',
      level: 'trace'
    }
  ],
  serializers: restify.bunyan.serializers,
});

var server = restify.createServer({name:'api', log: logger});
server.use(restify.requestLogger());
//server.pre(restify.CORS());
//server.use(restify.fullResponse());
server.use(restify.CORS());
//var cors = require('cors');
//server.use(cors());
//server.use(restify.fullResponse());

server.use(restify.acceptParser(server.acceptable));
server.use(restify.authorizationParser());
server.use(restify.dateParser());
server.use(restify.queryParser());
server.use(restify.bodyParser({mapParams: true}));
server.use(restify.urlEncodedBodyParser());

// When a client request is sent for a URL that does not exist, restify will emit this event. Note that restify checks for listeners on this event, and if there are none, responds with a default 404 handler. It is expected that if you listen for this event, you respond to the client.
//server.on('NotFound', function (request, response, cb) {}); 
// When a client request is sent for a URL that does exist, but you have not registered a route for that HTTP verb, restify will emit this event. Note that restify checks for listeners on this event, and if there are none, responds with a default 405 handler. It is expected that if you listen for this event, you respond to the client.
server.on('MethodNotAllowed', function (request, response, cb) {}); 
// When a client request is sent for a route that exists, but does not match the version(s) on those routes, restify will emit this event. Note that restify checks for listeners on this event, and if there are none, responds with a default 400 handler. It is expected that if you listen for this event, you respond to the client.
server.on('VersionNotAllowed', function (request, response, cb) {});     
 // When a client request is sent for a route that exist, but has a content-type mismatch, restify will emit this event. Note that restify checks for listeners on this event, and if there are none, responds with a default 415 handler. It is expected that if you listen for this event, you respond to the client.
server.on('UnsupportedMediaType', function (request, response, cb) {}); 
// Emitted after a route has finished all the handlers you registered. You can use this to write audit logs, etc. The route parameter will be the Route object that ran.
server.on('after', function (request, response, route, error) {});
// Emitted when some handler throws an uncaughtException somewhere in the chain. The default behavior is to just call res.send(error), and let the built-ins in restify handle transforming, but you can override to whatever you want here.
//server.on('uncaughtException', function (request, response, route, error) {});  
//handle EADDRINUSE errors. This means that another server is already running on the requested port. One way of handling this would be to wait a second and then try again. 
server.on('error', function (e) {
  if (e.code == 'EADDRINUSE') {
    console.log('Address in use, retrying...');
    setTimeout(function () {
      shutdown();
      connect();
      boot();
    }, 1000);
  }
});

var conString = "postgres://postgres:inCUAHSIgres@localhost:5432/mydb";
var rowLimit = 20;
 
var client = new pg.Client(conString);
var connect = function() {
  client.connect(function(err, client, done) {

        var handleError = function(err) {
            // no error occurred, continue with the request
            if(!err) return false;
            
            // An error occurred, remove the client from the connection pool.
            // A truthy value passed to done will remove the connection from the pool
            // instead of simply returning it to be reused.
            // In this case, if we have successfully received a client (truthy)
            // then it will be removed from the pool.
            done(client);
            return true;
        };
    // set pg.defaults.poolSize, for update look at
    // transactons at https://github.com/brianc/node-postgres/wiki/Transactions
    client.query('SELECT NOW() AS "theTime"', function(err, result) {
      if(handleError(err)) return;
      console.log(result.rows[0].theTime);
    });
})};

function addPrevLink(number, req, res) {
  var l = 'http://' + req.headers.host + '/api/hucs?page=' + number;
  res.link(l, 'prevPage');
}

function addNextLink(number, req, res) {
  var l = 'http://' + req.headers.host + '/api/hucs?page=' + number;
  res.link(l, 'nextPage');
}

function readOneThenRespond(req, res, next) {  
  client.query('SELECT Name FROM HUC8 WHERE ID = $1', [req.params.id], function(err, result) {
    if(err) {
      return req.log('error running query', err);
    }
    req.log(result.rows[0]);
    res.send(200, JSON.stringify(result.rows[0]) + "\n");
    return next();
})};

function readPageThenRespond(req, res, next) {  
  var page = Number(req.params.page) || 1;
  if (rows = (Number(req.params.pageSize))) { rowLimit = rows };
  var sqlStr = 'SELECT * FROM HUC8 ORDER BY ID DESC OFFSET ' + String(page*rowLimit) + ' FETCH NEXT ' + String(rowLimit) + ' ROWS ONLY';
  client.query(sqlStr, function(err, result) {
    if(err) {
      return req.log.error('error running query', err);
    }
    if (page > 1) { addPrevLink(page - 1, req, res) };
    addNextLink(page+1, req, res);;
    res.send(200, JSON.stringify(result.rows) + "\n");
    return next();
})};

function createThenRespond(req, res, next) {  
  //INSERT INTO products (product_no, name, price) VALUES (1, 'Cheese', 9.99)
  var huc = req.params;

  client.query('INSERT INTO HUC8 (name, areasqkm, areaacres, states, id) VALUES ($1, 9.99, $3, $2)', [req.params.name, req.params.id, 'KY'], function(err, result) {
    if(err) {
      return req.log.error('error running query', err);
    }
    req.log(result.rows[0]);
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With");res.send(200, "");
    res.writeHead(200, {'Content-Type': 'application/json; charset=utf-8'});
    res.end(JSON.stringify(user));
    return next();
})};

server.pre(function (req, res, next) {
  return next();
});

server.on('after', restify.auditLogger({log: logger}));

server.get('/api/hucs/:id', readOneThenRespond);

server.get('/api/hucs/', readPageThenRespond);

server.post('/api/hucs/', createThenRespond);


var port=process.env.PORT;
var boot = function() {server.listen(port, function() {
    console.log('listening: %s', server.url);
})};
var shutdown = function() {server.close()};
if (require.main === module) {
  connect();
  boot();
}

else {
  console.log('Running app as a module')
  exports.boot = boot;
  exports.shutdown = shutdown;
  exports.connect = connect;
}
