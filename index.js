var util = require('util');
var Apiclient = require('apiclient');
var ee = require('events');
var seedgl5 = require('./gl5seed.json');
var seedgl10 = require('./gl10seed.json');
var dbfile = require('flatfile');
var Log = require('log');
var waittime = 6000;
var waitcount = 1;
var beep = require('beepbeep');

// console.log(seedgl5);
var Gl5api = new Apiclient(seedgl5);
var Gl10api = new Apiclient(seedgl10);

if (!Array.isArray) {
  Array.isArray = function(arg) {
    return Object.prototype.toString.call(arg) === '[object Array]';
  };
}

function isJSON (input) {
  try {
    JSON.parse(input);
  } catch (e) {
    return false;
  }
  return true;
}

function isObject(val) {
  if (val === null) { return false;}
  return ( (typeof val === 'function') || (typeof val === 'object') );
}

function Septian() {
  ee.call(this);
}
util.inherits(Septian, ee);
const asep = new Septian();
asep.setMaxListeners(20);

function note(message, level) {
  var fs = require('fs');
  var logfile = new Log('warning', fs.createWriteStream('migration.log', {
    flags: 'a'
  }));
  var logscreen = new Log('warning');
  switch (level) {
    case 'emergency':
      logfile.emergency(message);
      logscreen.emergency(message);
      break;
    case 'alert':
      logfile.alert(message);
      logscreen.alert(message);
      break;
    case 'critical':
      logfile.critical(message);
      logscreen.critical(message);
      break;
    case 'error':
      logfile.error(message);
      logscreen.error(message);
      break;
    case 'warning':
      logfile.warning(message);
      logscreen.warning(message);
      break;
    case 'notice':
      logfile.notice(message);
      logscreen.notice(message);
      break;
    case 'info':
      logfile.info(message);
      logscreen.info(message);
      break;
    case 'debug':
      logfile.debug(message);
      logscreen.debug(message);
      break;
    default:
      logfile.debug(message);
      logscreen.debug(message);
  }
}

function genRand(max) {
  var out = [];
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmopqrstuvwzyx1234567890-_=+[]{}|,./<>?;':\"!@#$%^&*()";
  for (var i = 0; i < max; i++) {
    out.push(possible.charAt(Math.floor(Math.random() * possible.length)));
  }
  return out.join("");
}

function testCon(repeat) {
  if (typeof repeat == 'undefined') repeat = false;
  do {
    Gl10api.get('version', {}, {}, function (e, r, b) {
      if ((r != null) && (r.statusCode == 200)) {
        asep.emit('testcon_ok');
      } else {
        testCon(true);
      }
    });
  } while (repeat);
}

function wait(fun, time) {
  waitcount = waitcount + 1;
  waittime = time * Math.pow(waitcount, 2);
  note(util.format('Waiting %d millisecond as requested', waittime), 'warning');
  setTimeout(fun, waittime);
//  testCon(true);
//  asep.on('testcon_ok', function () { fun; });
}

function mailer(recipient, subject, body) {
  var nml = require('nodemailer');
  var transporter = nml.createTransport({
    host: 'smtp.mailtrap.io',
    port: 2525,
    secure: false,
    auth: {
      user: 'f7afd71b26f803',
      pass: 'ad80a3938f06d9'
    }
  });
  var theMail = {
    from: 'gitlab.migration@wibisono.web.id',
    to: recipient,
    subject: subject,
    text: body,
    html: ''
  };
  transporter.sendMail(theMail, function (error, info) {
    if (error) asep.emit('error', error);
    console.log(util.format("Message sent with id %d", info.messageId));
  });
}

/**
 * isUpdated
 * Check if database is expired or updated
 * @params update	boolean	if not updated, update the database or not.
 * @params signal	string	positive signal for event emitter. emitted if database is updated.
 * @params negsignal	string	negative signal for event emitter. emitted if database is not updated.
 */
function isUpdated(update, signal, negsignal) {
  if ( (typeof update == 'undefined') || (update == '') || (update == null) ) {
    update = false;
  }
  if ( (typeof signal == 'undefined') || (signal == '') || (signal == null) ) {
    signal = 'update_positive';
  }
  if ( (typeof negsignal == 'undefined') || (negsignal == '') || (negsignal == null) ) {
    negsignal = 'update_negative';
  }
  var now = Math.floor(new Date() / 1000);
  var expired = now - 21600;
  var fs = require('fs');
  fs.access('data.json', fs.F_OK | fs.W_OK, function (err) {
    if (err) { // belum ada database
      // NOTES:
      // [x] apakah database file bisa ditulis. bila tidak, kembalikan error.
      // [x] apakah diijinkan untuk update file via parameter input update. bila tidak, biarkan saja.
      // bila semuanya ok. lakukan update pada database.
      if (update) {
        dbfile.db('data.json', function (err, data) {
          if (err) {
            asep.emit('error', err);
          } else {
            data.__timestamp__ = now;
            asep.emit(signal);
          }
        });
      } else {
        asep.emit(negsignal);
      }
    } else {
      dbfile.db('data.json', function (err, data) {
        if (typeof data.__timestamp__ === 'undefined') { // belum ada data timestamp
          if (update) {
            data.__timestamp__ = now;
          } else {
            asep.emit(negsignal);
          }
        } else {
          if (data.__timestamp__ < expired) { // expired
            if (update) {
              data.__timestamp__ = now;
              asep.emit(signal);
            } else {
              asep.emit(negsignal);
            }
          } else {  // belum expired
            asep.emit(signal);
          }
        }
      });
    }
  });
}

function save(key, value, signal) {
  var now = Math.floor(new Date() / 1000);
  if ( (typeof signal == 'undefined') || (signal == '') || (signal == null) ) {
    signal = 'datastored';
  }
  dbfile.db('data.json', function(err, data) {
    data[key] = value;
    data.__timestamp__ = now;
    data.save(function (err) {
      if (err != null) {
        asep.emit('error', err);
//        callback(false);
      } else {
        console.log(util.format("Data stored....\n"));
        asep.emit(signal);
      }
    });
  });
}

function load(key, callback, signal) {
  if ( (typeof signal == 'undefined') || (signal == '') || (signal == null) ) {
    signal = 'dataloaded';
  }
  dbfile.db('data.json', function (err, value) {
    if (err != null) asep.emit('error', err);
    // Bila belum ada isinya atau kosong, maka isi dengan array kosong.
    if (typeof value[key] === 'undefined') {
      asep.emit(signal, []);
      if (typeof callback === 'function') callback([]);
    } else {
      asep.emit(signal, value[key]);
      if (typeof callback === 'function') callback(value[key]);
    }
    console.log(util.format("Data loaded....\n"));
  });
}

function getProjectByProjectName(name, callback) {
//  loadProjects(0, true, 'projectbyname_signal');
//  asep.on('projectbyname_signal', function () {
//    load('projects', function (result) {
//      var project = result.filter(function (c, i, a) {
//        return c.path_with_namespace === name;
//      });
//      callback(project[0]);
//    });
//  });
  Gl10api.get('projects', {}, {
    qs: {
      search: name
    }
  }, function (e, r, b) {
    if (e) asep.emit('error', e);
    switch (r.statusCode) {
      case 200:
      callback(JSON.parse(b)[0]);
      break;
    case 404:
      callback({});
      break;
    case 502:
      wait(getUserByUsername(username, callback), 6000);
        note('Received bad gateway when get user by Username, try to wait for 6 second.', 'warning');
      break;
    default:
      asep.emit('error', r, b);
      break;
    }
  });
}

function getUserByUsername(username, callback) {
  Gl10api.get('users', {}, {
    qs: {
    username: username
    }
  }, function (e, r, b) {
    if (e) asep.emit('error', e);
    switch (r.statusCode) {
      case 200:
      callback(JSON.parse(b)[0]);
      break;
    case 404:
      callback({});
      break;
    case 502:
      wait(getUserByUsername(username, callback), 6000);
        note('Received bad gateway when get user by Username, try to wait for 6 second.', 'warning');
      break;
    default:
      asep.emit('error', r, b);
      break;
    }
  });
}

function createUser(users, index, signal) {
  if ( (typeof signal == 'undefined') || (signal == '') || (signal == null) ) {
    signal = 'usercreated';
  }
  if (index >= users.length) {
    asep.emit('userIndexOutOfBound', index, users);
  } else {
    var user = users[index];
    if (typeof user === 'undefined') debugger;
    var u = {
      username: user.username,
      email: user.email,
      name: user.name,
      password: genRand(16),
      reset_password: true
    };
  
  
    if (u.username !== 'root') {
      console.log(util.format("Creating new user with username %s", u.username));
      Gl10api.post('users', {}, {
        //body: u
        body: JSON.stringify(u),
        headers: {
  	"Content-Type": "application/json"
        }
      }, function (e, r, b) {
        if (e != null) asep.emit('error', e);
        switch (r.statusCode) {
          case 201:
  	  getUserByUsername(u.username, function (regedUser) {
  	    asep.emit(signal, regedUser, index, users);
  	  });
            break;
          case 409:
  	  getUserByUsername(u.username, function (regedUser) {
  	    asep.emit('userduplicate', regedUser, index, users);
  	  });
            break;
          case 502:
            wait(createUser(users, index, signal), 6000);
            note('Received bad gateway when create user, try to wait for 6 second.', 'warning');
            break;
          default:
            asep.emit('error', r, b);
            break;
        }
      });
    } else {
      asep.emit(signal, user, index, users);
    }
  }
}

function saveProject(artefact, signal) {
  if ( (typeof signal == 'undefined') || (signal == '') || (signal == null) ) {
    signal = 'projectssaved';
  }
  console.log('running saveProject function');
  load('projects', function (projects) {
    var done = artefact.every(function (c, i, a) {
      return projects.push(c);
    });
    if (done) {
      save('projects', projects);
      asep.once('datastored', function() {
        asep.emit(signal);
      });
    } 
  });
}

function findDup(artefact) {
  var out = [];
  var ai = artefact.map(function (c) { return c.id; });
  var ids = ai.sort().filter(function (c, i, a) {
    return !i || c != a[i - 1];
  });
  ids.forEach(function (c, i, a) {
    out.push(artefact.filter(function (cc) { return cc.id == c; })[0]);
  });
  return out;
}

/**
 * loadProjects
 * Mengambil project dari remote site disimpan pada dbfile
 */
function loadProjects(page, force, signal) {
  if ( (typeof force == 'undefined') || (force == '') || (force == null) ) {
    force = false;
  }
  if ( (typeof signal == 'undefined') || (signal == '') || (signal == null) ) {
    signal = 'projectsloaded';
  }
  function download(page) {
    if (page === null) page = 1;
    Gl5api.get('projects', {}, {
      qs: { page: page }
    }, function (e, r, b) {
      var baksen = JSON.parse(b);
      console.log(util.format("Found %d projects at page %d\n", baksen.length, page));
      if (baksen.length === 0) {
        load('projects', function (projects) {
          var p = findDup(projects);
          save('projects', p);
          asep.on('datastored', function () {
            asep.emit(signal);
          });
        });
      } else {
        saveProject(baksen);
        asep.once('projectssaved', function () {
          loadProjects(page+1, true, signal);
        });
      }
    });
  }
  if (force) {
    download(page);
  } else {
    isUpdated(false, 'loadProjects_update_positive', 'loadProjects_update_negative');

    asep.on('loadProjects_update_positive', function () {
      asep.emit(signal);
    });

    asep.on('loadProjects_update_negative', function () {
      download(page);
    });
  }
}

function loadUsers(signal) {
  if ( (typeof signal == 'undefined') || (signal == '') || (signal == null) ) {
    signal = 'usersloaded';
  }
  isUpdated(false, 'loadusers_update_positive', 'loadusers_update_negative');
  asep.on('loadusers_update_positive', function () {
    asep.emit(signal);
  });
  asep.on('loadusers_update_negative', function () {
    Gl5api.get('users', {}, {}, function (e, r, b) {
      var baksen = JSON.parse(b);
      console.log(util.format("Found %d users\n", baksen.length));
      load('users', function (users) {
        var done = baksen.every(function (c, i, a) {
          return users.push(c);
        });
        if (done) {
          var p = findDup(users);
          save('users', p);
          asep.once('datastored', function() {
            asep.emit(signal);
          });
        }
      });
    });
  });
}

function createProject(user, ps, index, signal) {
  if ( (typeof signal == 'undefined') || (signal == '') || (signal == null) ) {
    signal = 'projectcreated';
  }
  var p = ps[index];
  var project = {};

  if (p == null) {
    project = {
      user_id: user.id,
      name: '',
      path: '',
      //namespace_id: 0,
      description: '',
      issues_enabled: false,
      merge_request_enabled: false,
      wiki_enabled: false,
      visibility: 'private'
    };
  } else {
    project = {
      user_id: user.id,
      name: p.name,
      path: p.path,
      //namespace_id: p.namespace_id,
      description: p.description,
      issues_enabled: p.issues_enabled,
      merge_request_enabled: p.merge_request_enabled,
      wiki_enabled: p.wiki_enabled,
      visibility: p.visibility
    };
  }

  Gl10api.post('projects', {
    user_id: user.id
  }, {
    body: JSON.stringify(project),
    headers: {
      "Content-Type": "application/json"
    }
  }, function (e, r, b) {
    // console.log(e, r, b);
    if (e != null) {
      if (e.text === 'Error: socket hang up') {
        wait(createProject(user, ps, index, signal), 6000);
        note('Socket hang up when create user, try to wait for 6 second.', 'warning');
      } else if (e.code === 'EADDRNOTAVAIL') {
        wait(createProject(user, ps, index, signal), 6000);
        note('Address not available when create project, try to wait for 6 second.', 'warning');
      } else if (e.code === 'ETIMEDOUT') {
        wait(createProject(user, ps, index, signal), 6000);
        note('Timeout when create project, try to wait for 6 second.', 'warning');
      } else {
        asep.emit('error', e);
      }
    } else {

      switch (r.statusCode) {
        case 201:
          console.log(util.format("Project %s created on user %s\n", p.name, user.name));
          asep.emit(signal, project, index, ps);
          break;
        case 400:
          note(util.format("Bad request, body sent: %j \n response message: %s", project, r.statusMessage), 'critical');
          asep.emit(signal, project, index, ps);
          break;
        case 502:
          wait(createProject(user, ps, index, signal), 6000);
          note('Received bad gateway when create project, try to wait for 6 second.', 'warning');
          break;
        default:
          asep.emit('error', r, b, e);
      }
    }
  });
}

function createUserListener(user, lastIndex, users) {
  console.log('listener usercreated called');
  load('projects', function (result) {
    console.log('listener dataloaded on after load project called');
//      process.exit(2);
    var index = lastIndex + 1;
    if (index < users.length) {
      // create a project here.
      var p = result.filter(function (c, i, a) {
	return c.owner.username == user.username;
      });
      if (p.length != 0) {
	console.log(util.format("Found %d projects on user %s, we're creating projects for user.", p.length, user.name));
        console.log(p.map(function(c){ return c.name; }).join("\n"));
	createProject(user, p, 0, 'createUserListener_projectcreated');
	asep.on('createUserListener_projectcreated', function (project, lastIndex, projects) {
          if (lastIndex < projects.length - 1) { // selama masih ada project dalam user yang sama
            var idx = lastIndex + 1;
            createProject(user, projects, idx, 'createUserListener_projectcreated');
          } else { // project dalam user sudah habis.
	    createUser(users, index);
          }
        });
      } else {
	createUser(users, index);
      }
    } else {
      console.log(util.format("Last index created %d", lastIndex));
      console.log(util.format("Total user loaded %d", users.length));
    }
    console.log('wow');
    console.log(asep.listenerCount('dataloaded'));
  });
}

//loadUsers('dumptolocalmem');
//asep.on('dumptolocalmem', function () {
//  load('users', function (users) {
//  });
//});

// TODO:
// 1. [x] Ambil user dulu, semua.
// 2. [x] Ambil projects, semua juga, secara async.
// 3. [x] Tulis semua user ke sistem baru.
// 4. [x] Berdasarkan projects yang telah diambil, tulis semua projects ke sistem baru.
// 5. [x] Verify status
// 6. [-] Construct groups.

function verifyStatus() {
  load('projects', function (result) {
    function checkProject(i, a) {
      var c = a[i];
      if (i == a.length-1) {
        asep.emit('verify_valid');
      } else {
        console.log(util.format("Verifying project %s owned by user %s", c.path, c.owner.name));
        if (typeof c === 'undefined') debugger;
        getUserByUsername(c.owner.name, function (user) {
          if (isObjectEmpty(user)) {
            asep.emit('verify_invalid', c, user);
          } else {
            if (i == result.length) {
              asep.emit('verify_valid');
            } else {
              getProjectByProjectName(c.path, function (project) {
                if (isObjectEmpty(project)) {
                  asep.emit('verify_invalid', c, user);
                } else {
                  // TODO:
                  // 1. [-] cek relasi antara project, member dan user. 
                  // 2. [-] bila membernya hanya 1, dan itu adalah owner, maka lolos, bila yang lain maka gagal.
                  // 3. [x] ini hanya cek apakah user dan project sudah ada, dan username pemilik project masih sama.
                  
                  console.log(util.format("Project %s owned by user %s is verified", c.path, c.owner.name));
                  checkProject(i+1, result);
                }
              });
            }
          }
        });
      }
    }
    checkProject(0, result);
  });
}

function isObjectEmpty(obj) {
  for(var prop in obj) {
    if(obj.hasOwnProperty(prop))
      return false;
  }
  
  return JSON.stringify(obj) === JSON.stringify({});
}

function projectsMembers() {
  console.log("Reconnecting user project relationship.");
  // NOTES:
  // - Asumsinya semua project dan user telah dimuat di memory jadi tidak perlu load ulang.
  load('projects', function (projects) {
    load('users', function (users) {
      function checkMember(idx, ar, users, c, i, a) {
        var cu = ar[idx];
        var memberscount = idx;
        var owner = c.owner.username;
//        var owner = c.path_with_namespace.split('/')[0];

        Gl10api.get('projects', {}, {
          qs: {
            search: c.path,
            sudo: owner,
            owned: true
          }
        }, function (err, resp, body) {
          var dy = sanitateStringObject(body);
          if (dy.length == 0) {
            // TODO: handle kalau kosong.
            console.log('kosong line 632');
            debugger;
          } else {
            if (typeof dy.filter !== 'function') {
              debugger;
            }
            var p = dy.filter(function (project) {
              return project.path == c.path;
            });
            if (p.length == 0) {
              // TODO: handle kalau kosong.
              console.log('kosong line 639');
              debugger;
            } else {
              c = p[0];
              Gl10api.get('users', {}, {
                qs: {
                  search: cu.username
                }
              }, function (ger, gres, gbod) {
                var us = JSON.parse(gbod);
                if (Array.isArray(us)) {
                  var u = us.filter(function (c) { return c.username == cu.username; });
                } else {
                  asep.emit('error', us);
                  console.log('error, line 660');
                  debugger;
                }
                if ((u != null) && (u.length == 1)) {
                  u = u[0];
                  // debugger;
                  Gl10api.post('projectsmember', {
                    projectid: c.id
                  }, {
                    json: true,
                    body: {
                      user_id: u.id,
                      access_level: cu.access_level
                    }
                  }, function (er, re, bo) {
                    // post project member.
                    console.log(util.format("Linking project %s", c.path));
                    if (c.path == 'toip_hlr_vs_lacci_performance') debugger;
                    if (er != null) {
                      asep.emit('error', er);
                    } else {
                      console.log(re.statusCode);
                      switch (re.statusCode) {
                        case 201:
                          memberscount++;
                          console.log(util.format("Adding user %s on project %s", cu.username, c.path));
                          if (memberscount == ar.length) {
                            // satu project selesai.
                            if (i == a.length-1) {
                              // habis, semua projects
                              asep.emit('projectMember_done');
                            } else {
                              // masih ada project berikutnya.
                              checkProject(i+1, a, users);
                            }
                          } else {
                            checkMember(memberscount, ar, users, c, i, a);
                          }
                          // here the result of member creating.
                          break;
                        case 409:
                          memberscount++;
                          console.log(util.format("Member %s already exist in project %s, skipping.", cu.username, c.path));
                          if (memberscount == ar.length) {
                            // satu project selesai
                            if (i == a.length-1) {
                              // habis semua project
                              asep.emit('projectMember_done');
                            } else {
                              // masih ada project berikutnya.
                              if (typeof a[i+1] == 'undefined') debugger;
                              console.log(util.format("Linking %d of %d projects done, next project %s", i, a.length, a[i+1].path));
                              checkProject(i+1, a, users);
                            }
                          } else {
                            checkMember(memberscount, ar, users, c, i, a);
                          }
                          break;
                        default:
                          debugger;
                          memberscount++;
                          note(util.format('out of handle URL: %s, reqbody: %s, resbody: %s, code: %s, message: %s', re.request.href, re.request.body, JSON.stringify(re.body), re.statusCode, re.statusMessage), 'warning');
                          if (memberscount == ar.length) {
                            if (i == a.length) {
                              asep.emit('projectMember_done');
                            } else {
                              console.log(util.format("Linking %d of %d projects done, next project %s", i, a.length, a[i+1].path));
                              checkProject(i+1, a, users);
                            }
                          } else {
                            checkMember(memberscount, ar, users, c, i, a);
                          }
                          // asep.emit('error', er, re);
                      }
                    }
                  });
                } else {
                  console.log('kosong, line 722');
                  // TODO: handle lebih dari satu
                  debugger;
                }
              });
            }
          }
        });
      }

      function checkProject(i, a, users) {
        var c = a[i];
        // check every project here;
        // TODO:
        // 1. [x] ambil member dari project di /projects/[:projectid]/members
        // 2. [x] asumsinya owner menjadi salah satu dari record yang ada.
        // 3. [x] cek jumlah hasilnya, bila hasilnya lebih dari 1 maka masukkan user selain owner dalam member dari project ini.
        if (typeof c === 'undefined') debugger;
        Gl5api.get('projectsmember', {
          projectid: c.id
        }, {
          // options here
        }, function (e, r, b) {
          if (e != null) {
            asep.emit('error', e);
          } else {
            // get project member here
            switch (r.statusCode) {
              case 200:
                // hasil members here.
                var members = JSON.parse(b);
                if (members.length > 1) {
                  var memberscount = 0;
                  // looping member setiap project dari gitlab 5.
                  checkMember(0, members, users, c, i, a);
                  // members.forEach(function (cu, idx, ar) {
                  // }) ;
                } else {
                  checkProject(i+1, a, users);
                }
                break;
              case 404:
                beep(3, 1000);
                debugger;
                break;
            }
          }
        });
      }
      checkProject(0, projects, users);
    });
  });
}

function sanitateStringObject(input) {
  var output = null;
  if (isJSON(input)) {
    output = JSON.parse(input);
  } else if (isObject(input)) {
    output = input;
  } else {
    asep.emit('error', input);
  }
  return output;
}

function milestonesIssues() {
  /*
   * TODO:
   * - [ ] Do after all verified.
   * - [ ] get all milestones from all projects
   * - [ ] post all milestones to all moved projects
   * - [ ] get all issues from all projects
   * - [ ] post all issues from all projects
   */
  load('projects', function (projects) {
    projects.forEach(function (project, i, a) {
      Gl5api.get('milestones', {
        projectid: project.id
      }, {}, function (e, r, b) {
        switch (r.statusCode) {
          case 200:
            asep.emit('old_project_milestone_fetched', b);
            break;
          default:
            asep.emit('error', e, r);
            break;
        }
      });

      asep.on('project_milestone_fetched', function (b) {
        var milestones = sanitateStringObject(b);
        if (Array.isArray(milestones)) {
          if (milestones.length > 0) {
            milestones.forEach(function (milestone, i, a) {
              asep.emit('signal_create_milestone', milestone);
            });
            asep.emit('signal_all_milestones_created');
          } else {
            console.log('Empty milestones, skip it.');
          }
        } else {
          asep.emit('error', milestones);
        }
      });

      asep.on('signal_create_milestone', function (oldMilestone) {
        Gl10api.post('milestones', {
          projectid: encodeURIComponent(project.path_with_namespace)
        }, {
          body: JSON.stringify({
            title: oldMilestone.title,
            description: oldMilestone.description,
            due_date: oldMilestone.due_date
          })
        }, function (e, r, b) {
          switch (r.statusCode) {
            case 201:
              asep.emit('project_milestone_created', b);
              break;
            default:
              asep.emit('error', e, r);
              break;
          }
        });
      });

      asep.on('project_milestone_created', function (b) {
        var newMilestone = sanitateStringObject(b);

        console.log(util.format('Milestone %s on project id %d created', newMilestone.title, newMilestone.project_id));
      });

      asep.on('signal_all_milestones_created', function () {
        Gl5api.get('issues', {
          projectid: project.id
        }, {}, function (e, r, b) {
          switch (r.statusCode) {
            case 200:
              asep.emit('old_project_issues_fetched', b);
              break;
            default:
              asep.emit('error', e, r);
              break;
          }
          if (e) asep.emit('error', e, r);
        });
      });

      asep.on('old_project_issues_fetched', function (b) {
        var old_issues = sanitateStringObject(b);

        if (Array.isArray(old_issues)) {
          if (old_issues.length > 0) {
            old_issues.forEach(function (old_issue, i, a) {
              if (old_issue.milestone !== null) {
                asep.emit('signal_get_milestone', old_issue);
              } else {
                asep.emit('signal_create_issue', old_issue, null);
              }
            });
            asep.emit('signal_all_issues_created');
          } else {
            console.log('empty issues, skip it');
          }
        } else {
          asep.emit('error', old_issues);
        }
      });

      asep.on('signal_get_milestone', function (old_issue) {
        Gl10api.get('milestones', {
          projectid: encodeURIComponent(project.path_with_namespace)
        }, {
          qs: {
            search: old_issue.milestone.title
          }
        }, function (e, r, b) {
          var milestone = [];
          switch (r.statusCode) {
            case 200:
              milestone = sanitateStringObject(b);
              if (Array.isArray(milestone) && milestone.length > 0) {
                if (milestone.length == 1) {
                  asep.emit('signal_create_issue', old_issue, milestone[0]);
                } else {
                  console.log(util.format('%d milestones found, use the first milestone as issue milestone', milestone.length));
                  asep.emit('signal_create_issue', old_issue, milestone[0]);
                }
              }
              break;
            default:
              asep.emit('error', e, r);
              break;
          }
          if (e) asep.emit('error', e, r);
        });
      });

      asep.on('signal_create_issue', function(old_issue, newMilestone) {
        var body = {
          title: old_issue.title,
          description: old_issue.description,
          confidential: false,
          labels: old_issue.labels.join(','),
          created_at: old_issue.created_at,
        };
        if (newMilestone) {
          body.milestone_id = newMilestone.id;
        }
        if (old_issue.assignee) {
          body.assignee_ids = old_issue.assignee.id;
        }

        Gl10api.post('issues', {
          projectid: project.id
        }, {
          body: body
        }, function (e, r, b) {
          var issue_response = null;
          if (e) asep.emit('error', e, r);
          switch (r.statusCode) {
            case 201:
              issue_response = sanitateStringObject(b);
              asep.emit('signal_issue_created', issue_response);
              break;
            default:
              asep.emit('error', b, r);
              break;
          }
        });
      });

      asep.on('signal_issue_created', function (issue_response) {
        console.log(issue_response);
      });
    });
  });
}

//projectsMembers();
//asep.on('projectMember_done', function () {
//  verifyStatus();
//});
//asep.on('verify_invalid', function (project, user) {
//  console.log(util.format("Oh, dear. project %j with user %j invalid", project, user));
//});
//asep.on('verify_valid', function () {
//  console.log('yay!!!!');
//  process.exit(0);
//});

loadUsers('main_loadUsers');
// loadProjects(1, true, 'main_loadProjects');
asep.on('main_loadUsers', function () {
  load('users', function (result) {
    createUser(result, 0, 'main_createUser');
  });
  asep.on('main_createUser', function (lastUser, lastIndex, users) {
    //console.log(lastUser);
    createUser(users, lastIndex + 1, 'main_createUser');
  });
  asep.on('userduplicate', function (lastUser, lastIndex, users) {
    console.log(util.format("Skip create existing user %s", lastUser.name));
    createUser(users, lastIndex + 1, 'main_createUser');
  });
  asep.on('userIndexOutOfBound', function (index, users) {
    // (1) done. insert user selesai disini.
    var count = 0;
    loadProjects(1, true, 'main_loadProjects');
    asep.on('main_loadProjects', function () {
      load('projects', function (result) {
        
        result.forEach(function (c, i, a) {
          getUserByUsername(c.owner.username, function (user) {

            if (!isObjectEmpty(user)) {
              createProject(user, result, i, 'main_createProject');
            } else {}
          });
        });
      });
    });
    asep.on('main_createProject', function (project, lastIndex, projects) {
      count = count + 1;
      console.log(util.format("Project index %s, %s created", lastIndex, project.name));
      if (count == projects.length) { // ketika semua sudah selesai
        projectsMembers();
        asep.on('projectMember_done', function () {
          verifyStatus();
        });
        asep.on('verify_invalid', function (project, user) {
          console.log(util.format("Oh, dear. project %j with user %j invalid", project, user));
        });
        asep.on('verify_valid', function () {
//          milestonesIssues();
//          asep.on('signal_all_issues_created', function () {
            console.log('yay!!!!');
            process.exit(0);
//          });
        });
        console.log('selesai');
        console.log(count);
        console.log(projects.length);
      }
    });
  });
});

// console.log("Getting projects\n");
// loadProjects(1, false, 'main_loadProjects');
// asep.once('main_loadProjects', function () {
//   // load project to memory done
//   loadUsers('main_loadUsers');
//   asep.on('main_loadUsers', function () {
// //    load('users');
//     load('users', function (result) {
//       console.log('listener dataloaded on create user called');
//       createUser(result, 0);
//       console.log(result.length);
//     }, 'buang');
//   });
//   asep.on('usercreated', createUserListener);
//   asep.on('userduplicate', function (user, lastIndex, users) {
//     createUserListener(user, lastIndex+1, users);
//   });
// });
//asep.on('projectsloaded', function () {
//  load('projects');
//  asep.once('dataloaded', function (result) {
//    console.log('run on mainline program');
//    console.log(util.format("%d projects saved in local file\n", result.length));
//    
//    process.exit(0);
//  });
//});
//asep.on('projectsloaded', function () {
//  asep.on('usersloaded', function () {
//    load('users');
//    asep.once('dataloaded', function (result) {
//      console.log(util.format("%d users loaded", result.length));
//    });
//    console.log('user loaded');
//    process.exit(0);
//  });
//  console.log('project loaded');
//});
asep.on('error', function (err, obj) {
  beep(3, 1000);
  console.trace();
  debugger;
  console.log(obj);
  throw err;
});
// console.log("Getting users\n");
// Gl5api.get('users', {}, {}, function (e, r, b) {
//   var baksen = JSON.parse(b);
//   console.log(util.format("Found %d users\n", baksen.length));
//   save('users', baksen);
//   baksen.forEach(function (c, i, a) {
//     console.log(util.format("Processing user %s", c.username));
//     createUser(c, function (err) {
//       if (err) {
//         throw err;
//         process.exit(1);  // TODO: sekarang ini kalau error aplikasi keluar, cari solusi lain.
//       } else {
//         
//       }
//     });
//   });
//   process.exit(0);
// });

// var gitlab = require('gitlab')({
//   url:   'http://localhost:9090/',
//   token: 'WQNLnazyEkgcDajjSEhS'
// });
// 
// console.log(gitlab.projects);
