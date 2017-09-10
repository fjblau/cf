'use strict';

exports.calcCF = function(req,res) {
  var modes = {
    'roadTransport' : 62,
    'railTransport' : 22,
    'bargeTransport' :31,
    'shortSea' :16,
    'intermodalRoadRail' :26,
    'intermodalRoadBarge' :34,
    'intermodalRoadShortSea' :21,
    'pipeline' :5,
    'deepSeaContainer' :8,
    'deepSeaTanker':5,
    'airfreight' :602
  };

  var tm = req.body.transportMode;
  var ef =  modes[req.body.transportMode];
  var km = req.body.km;
  var tonnage = req.body.tonnage;
  var cf = ef * km * tonnage;

  res.json({"distance":km, "tonnage":tonnage, "transportMode": tm, "CarbonFootrint": cf});
};
