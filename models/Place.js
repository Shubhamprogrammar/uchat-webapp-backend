const mongoose = require("mongoose");

const PlaceSchema = new mongoose.Schema({
    name: { type: String, required: true },
    state: { type: String, required: true },
    id: { type: Number, required: true, unique: true }
});

module.exports = mongoose.model("Places", PlaceSchema);