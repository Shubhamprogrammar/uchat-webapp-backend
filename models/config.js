const mongoose = require('mongoose');
const process = require('process');
const dotenv = require('dotenv')

dotenv.config();

const mongoURI = process.env.MONGO_URI;

const connectToMongo = async ()=>{
    mongoose.connect(mongoURI);
    console.log("Mongoose connected successfully");
}

module.exports = connectToMongo;