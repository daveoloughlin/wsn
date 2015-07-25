var boot = require('../server').boot,
    shutdown=require('../server').shutdown,
    superagent=require('superagent'),
    chai=require('chai'),
    expect=chai.expect;

describe('server', function() {
    before(function(done){
        boot();
    });
    describe('homepage', function(){
        it('should respond to GET', function(done) {
            superagent
            .get('http://localhost:'+process.env.port+'/hucs?page=1')
            .end(function(res){
                expect(res.status).to.equal(200);
                done();
            });
        });
    });    
    after(function(){
        shutdown(); 
    });    
});