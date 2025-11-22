const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    photo:{
        type:String,
    },
    about:{
        type:String,
    },
    name:{
        type:String,
        required:true
    },
    mobile:{
        type:String,
        required:true
    },
    city:{
        type:String,
        required:true
    },
    gender:{
        type:String,
        required:true
    },
    state:{
        type:String,
        required:true
    },
    dob:{
        type:String,
        required:true
    },
    last_seen:{
        type:String,
        default:"Offline"
    },
    is_blocked:{
        type:Boolean,
        default:false
    },
    is_deleted:{
        type:Boolean,
        default:false
    }
}, { timestamps: true });

module.exports = mongoose.model("user",UserSchema)