import firebase from 'firebase'
var config = {
	apiKey: "AIzaSyBErQSS5ENn8Mh1Dy0Jxk2a5z3VVzFfvKk-JA8k",
	authDomain: "chinese-words-i-know.firebaseapp.com",
	databaseURL: "https://chinese-words-i-know.firebaseio.com",
	storageBucket: "chinese-words-i-know.appspot.com",
	messagingSenderId: "538855581810"
};
var fire = firebase.initializeApp(config);
export default fire;