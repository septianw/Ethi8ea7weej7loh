var util = require('util');
var ee = require('events');

function Septian() {
  ee.call(this);
}
util.inherits(Septian, ee);
const asep = new Septian();

// asep.on('jalan', function() {
//   console.log('sudah jalan');
// });
// 
// asep.emit('jalan');

var file = require('flatfile');
file.db('data.json', function (err, data) {
  if (err) throw err;
  asep.emit('loaded', data.projects);

  // data.projects = []
  
//  console.log(data);
  // data.save(function (err) {
  //   if (err) throw err;
  // });
});

function findDup(artefact) {
  var out = [];
  var ai = artefact.map(function (c) { return c.id; });
  var ids = ai.sort().filter(function (c, i, a) {
    return !i || c != a[i - 1];
  });
  ids.forEach(function (c, i, a) {
    out.push(artefact.filter(function (cc) { return cc.id == c; })[0])
  });
  return out;
}

asep.on('loaded', function (data) {
  if (typeof data === 'undefined') {
    console.log('kosong');
  } else {
    console.log('isi');
    var d = findDup(data);
    console.log(d);
    console.log(d.length);
  }
});

//  var d = require('./test.json');
// var da = JSON.parse(d);
// console.log(d.length);


