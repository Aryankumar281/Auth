import mongoose from "mongoose";

export async function connectDB(){
    try{
        await mongoose.connect(process.env.MONGO_URI as string);
        console.log("Database connected successfully");
    }catch(err){
        console.error("Error connecting to the database");

    }
}