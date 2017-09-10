"use strict";
const expect        = require('chai').expect;
const Response      = require('../bin/swagger-response');

describe('#lambda', function() {

    it('object response', function() {
        return Response.lambda({ url: '/pets/1234' }, 200, __dirname + '/resources/swagger.yaml')
            .then(function(response) {
                expect(Array.isArray(response)).to.equal(false);
                expect(typeof response).to.equal('object');
                expect(response).to.not.equal(null);
            });
    });

    it('array response', function() {
        return Response.lambda({ url: '/pets' }, 200, __dirname + '/resources/swagger.yaml')
            .then(function(response) {
                expect(response).to.be.instanceOf(Array);
            });
    });


});