const functions = require("firebase-functions");
const app = require("express")();

const { getAllScreams, postOneScream } = require("./handlers/screams");

// Firebase config:
const config = {
  apiKey: "AIzaSyClJdQl77TVrlDAvXjCfBOuvZqiFOBS_GI",
  authDomain: "socialape-62ab3.firebaseapp.com",
  databaseURL:
    "https://socialape-62ab3-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "socialape-62ab3",
  storageBucket: "socialape-62ab3.appspot.com",
  messagingSenderId: "167455888246",
  appId: "1:167455888246:web:6457cc706eb8d9eac16057",
  measurementId: "G-P76FMHSQER",
};

const firebase = require("firebase");
firebase.initializeApp(config);

// Scream Routes:
// GET data/screams from firebase collection:
app.get("/screams", getAllScreams);

// POST a scream/data to firebase collection with FBAuth middleware to check for an auth header:
app.post("/scream", FBAuth, postOneScream);

// FBAuth (Firebase Auth check) middleware function:
const FBAuth = (req, res, next) => {
  let idToken;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer ")
  ) {
    idToken = req.headers.authorization.split("Bearer ")[1];
  } else {
    console.error("No Token Found");
    return response.status(403).json({ error: "Unauthorized" });
  }

  admin
    .auth()
    .verifyIdToken(idToken)
    .then((decodedToken) => {
      req.user = decodedToken;
      return db
        .collection("/users")
        .where("userId", "==", req.user.uid)
        .limit(1)
        .get();
    })
    .then((data) => {
      req.user.handle = data.docs[0].data().handle;
      return next();
    })
    .catch((err) => {
      console.error("Error while verifying token", err);
      return response.status(403).json(err);
    });
};

// Helper function to validate emails client side:
const isEmail = (email) => {
  const regEx = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  if (email.match(regEx)) return true;
  else return false;
};

// Helper function to check if a field is empty client side:
const isEmpty = (string) => {
  if (string.trim() === "") return true;
  else return false;
};

// Signup Route:
app.post("/signup", (req, res) => {
  const newUser = {
    email: req.body.email,
    password: req.body.password,
    confirmPassword: req.body.confirmPassword,
    handle: req.body.handle,
  };

  let errors = {};

  // Email Validation:
  if (isEmpty(newUser.email)) {
    errors.email = "Must not be empty";
  } else if (!isEmail(newUser.email)) {
    errors.email = "Must be a valid Email";
  }

  // Password Validation:
  if (isEmpty(newUser.password)) errors.password = "Must not be empty";
  if (newUser.password !== newUser.confirmPassword)
    errors.confirmPassword = "Passwords must match";

  // Handle/username Validation:
  if (isEmpty(newUser.handle)) errors.handle = "Must not be empty";

  // Checking the errors object on the client side:
  if (Object.keys(errors).length > 0) return res.status(400).json({ errors });

  // Validating and creating new data/users server side:
  let token, userId;
  db.doc(`/users/${newUser.handle}`)
    .get()
    .then((doc) => {
      if (doc.exists) {
        return res.status(400).json({ handle: "this handle is already taken" });
      } else {
        return firebase
          .auth()
          .createUserWithEmailAndPassword(newUser.email, newUser.password);
      }
    })
    .then((data) => {
      userId = data.user.uid;
      return data.user.getIdToken();
    })
    .then((idToken) => {
      token = idToken;
      const userCredentials = {
        handle: newUser.handle,
        email: newUser.email,
        createdAt: new Date().toISOString(),
        userId,
      };
      return db.doc(`/users/${newUser.handle}`).set(userCredentials);
    })
    .then(() => {
      return res.status(201).json({ token });
    })
    .catch((err) => {
      console.error(err);
      if (err.code === "auth/email-already-in-use") {
        return res.status(400).json({ email: "Email is already in use" });
      } else {
        return res.status(500).json({ error: err.code });
      }
    });
});

// Login Route
app.post("/login", (req, res) => {
  const user = {
    email: req.body.email,
    password: req.body.password,
  };

  let errors = {};

  // Field validation to not allow empty fields:
  if (isEmpty(user.email)) errors.email = "Must not be empty";
  if (isEmpty(user.password)) errors.password = "Must not be empty";

  // Checking the errors object on the client side:
  if (Object.keys(errors).length > 0) return res.status(400).json({ errors });

  // Logging in with firebase:
  firebase
    .auth()
    .signInWithEmailAndPassword(user.email, user.password)
    .then((data) => {
      return data.user.getIdToken();
    })
    .then((token) => {
      return res.json({ token });
    })
    .catch((err) => {
      console.error(err);
      if (err.code === "auth/wrong-password") {
        return res
          .status(403)
          .json({ general: "Wrong credentials, please try again" });
      } else return res.status(500).json({ error: err.code });
    });
});

exports.api = functions.region("europe-west1").https.onRequest(app);
