const { MongoClient, ObjectId } = require("mongodb");
const express = require("express");
const passwordHash = require("password-hash");
const tmi = require("tmi.js");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(function (req, res, next) {
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:4200");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS, PUT, PATCH, DELETE"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-Requested-With,content-type"
  );
  res.setHeader("Access-Control-Allow-Credentials", true);
  next();
});

const client = new MongoClient("mongodb://localhost:27017");
client.connect();

app.get("/", (req, res) => {
  res.end();
});

app.post("/login", (req, res) => {
  const { login, password } = req.body;
  const db = client.db("twitchBot");
  const users = db.collection("users");
  users.findOne({ login: login }, (err, data) => {
    if (data === undefined) {
      res.json({ status: "error", msg: "Nieprawidłowe dane logowania" });
    } else {
      if (passwordHash.verify(password, data.password)) {
        res.json(data);
      } else {
        res.json({ status: "error", msg: "Nieprawidłowe dane logowania" });
      }
    }
  });
});

app.post("/register", (req, res) => {
  const { name, login, password } = req.body;
  if (name.length > 0 && login.length > 0 && password.length > 0) {
    const db = client.db("twitchBot");
    const users = db.collection("users");
    users.findOne({ login: login }, (err, data) => {
      if (err) {
        res.json({ status: "error", msg: "Server error" });
      } else {
        if (data === undefined) {
          const passwordHashed = passwordHash.generate(password);
          users.insertOne({
            userName: name,
            login: login,
            password: passwordHashed,
          });

          users.findOne({ userName: name }, (err, data) => {
            const sr = db.collection("songRequestStatus");
            sr.insertOne({ channelID: data._id.toString(), isActive: false });
          });
          res.json({ status: "ok", msg: "Registered" });
        } else {
          res.json({ status: "error", msg: "User already exist" });
        }
      }
    });
  } else {
    res.json({ status: "error", msg: "Empty fields" });
  }
});

app.post("/getWords", (req, res) => {
  const { userId } = req.body;
  const db = client.db("twitchBot");
  const words = db.collection("bannedWords");
  words.find({ userId: userId }).toArray((err, data) => {
    if (err) {
      res.json({ status: "error" });
    } else {
      if (data === undefined) {
        res.json({ status: "no-results" });
      } else {
        res.json({ words: data });
      }
    }
  });
});

app.post("/addWord", (req, res) => {
  const { name, isPerm, time, userId } = req.body;
  const db = client.db("twitchBot");
  const words = db.collection("bannedWords");
  words.insertOne({ userId, word: name, isPerm, time }, (err) => {
    if (err) res.json({ status: "error" });
    else res.json({ status: "ok" });
  });
});

app.delete("/deleteWord/:id", (req, res) => {
  const { id } = req.params;
  const db = client.db("twitchBot");
  const words = db.collection("bannedWords");
  words.deleteOne({ _id: ObjectId(id) }, (err) => {
    if (err) res.json({ status: "Error" });
    else res.json({ status: "ok" });
  });
});

app.patch("/editWord", (req, res) => {
  const { id, word, isPerm, time } = req.body;
  const db = client.db("twitchBot");
  const bannedWords = db.collection("bannedWords");
  bannedWords.updateOne(
    { _id: ObjectId(id) },
    { $set: { word: word, isPerm: isPerm, time: time } },
    (err) => {
      if (err) res.json({ status: "error" });
      else res.json({ status: "ok" });
    }
  );
});

app.post("/checkSr", (req, res) => {
  const { id } = req.body;
  const db = client.db("twitchBot");
  const sr = db.collection("songRequestStatus");
  sr.findOne({ channelID: id }, (err, data) => {
    if (err) res.json({ status: "error" });
    else {
      if (data.isActive === true) {
        res.json({ status: "ok", srStatus: true, id: data._id });
        //zpytanie o piuosenke dodac
      } else {
        res.json({ status: "ok", srStatus: false });
      }
    }
  });
});

app.get("/song/:id", (req, res) => {
  const { id } = req.params;
  console.log(id);
  res.end();
});

app.patch("/changeSrStatus", (req, res) => {
  const { userID, status } = req.body;
  console.log(userID);
  const db = client.db("twitchBot");
  const sr = db.collection("songRequestStatus");
  sr.updateOne({ channelID: userID }, { $set: { isActive: status } });
  res.end();
});

app.get("*", (req, res) => {
  res.end();
});
app.post("*", (req, res) => {
  res.end();
});
app.put("*", (req, res) => {
  res.end();
});
app.patch("*", (req, res) => {
  res.end();
});
app.delete("*", (req, res) => {
  res.end();
});

app.listen(3000, () => {
  console.log("server is running at 127.0.0.1:3000");
});

//twitch bot

const db = client.db("twitchBot");
const users = db.collection("users");
const chanelList = [];
users.find({}).toArray((err, data) => {
  data.forEach((record) => {
    chanelList.push(record.userName);
  });
  if (chanelList.length > 0) {
    botFunction();
  }
});

const botFunction = () => {
  const tmiClienit = new tmi.Client({
    identity: {
      username: "",
      password: "",
    },
    channels: chanelList,
  });

  tmiClienit.connect();

  tmiClienit.on("message", (channel, tags, message, self) => {
    if (self) return;
    if (message.slice(0, 2) === "Hi") {
      tmiClienit.say(channel, `@${tags["username"]} Hello!`);
    } else if (message.charAt(0) === "!") {
      const command = message.split(" ")[0].substring(1, message.length);
      switch (command) {
        case "baner":
          tmiClienit.say(
            channel,
            `@${tags["username"]} Ta normalnie sponsorowane jest!`
          );
          break;
        case "sr":
          const db = client.db("twitchBot");
          const users = db.collection("users");
          users.findOne(
            { userName: channel.substring(1, channel.length) },
            (err, data) => {
              if (err) return null;
              else {
                const sr = db.collection("songRequestStatus");
                sr.findOne({ channelID: data._id.toString() }, (err, data) => {
                  if (err) return null;
                  else {
                    if (data !== undefined) {
                      if (data.isActive) {
                        const songList = db.collection("songList");
                        songList.insertOne({
                          channelID: data.channelID,
                          link: message.split(" ")[1],
                        });
                        tmiClienit.say(
                          channel,
                          `@${tags["username"]} dodano do sr!`
                        );
                      } else {
                        tmiClienit.say(channel, "Nie ma sr teraz");
                      }
                    } else {
                      return null;
                    }
                  }
                });
              }
            }
          );
          break;
      }
    } else {
      const db = client.db("twitchBot");
      const words = db.collection("bannedWords");
      const users = db.collection("users");
      users.findOne(
        { userName: channel.substring(1, channel.length) },
        (err, data) => {
          if (err) return null;
          else {
            words.find({ userId: data._id.toString() }).toArray((err, data) => {
              data.forEach((word) => {
                if (message.indexOf(word.word) !== -1) {
                  tmiClienit.ban(tags["username"]);
                  console.log(`Banned user ${tags["username"]}`);
                }
              });
            });
          }
        }
      );
    }
  });
};

console.log("Russel_BOT started");
