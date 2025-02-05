import dotenv from "dotenv";
import connectDB from "./db/index.js";
import app from "./app.js";

dotenv.config({
  path: "./env",
});

connectDB()
  .then(() => {
    app.listen(process.env.PORT, () => {
      console.log(`App is listening on port ${process.env.PORT}`);
    });
  })
  .catch((error) => {
    console.log("MONGO db connection failed !!! ", error);
  });




  

// Another way
// ;((async () => {
//   try {
//     await mongoose.connect(`${process.env.MONGODB_URL}/${DB_NAME}`);

//     app.on("errror", (error) => {
//       console.log("ERROR: ", error);
//       throw error;
//     });

//  app.listen(process.env.PORT, () => {
//    console.log(`App is listening on port ${process.env.PORT}`);
//  });
//   } catch (error) {
//     console.log('MongoDB connection failed', error);
//   }
// })) ();
