const { gql, UserInputError, AuthenticationError } = require("apollo-server");
const { ApolloServer } = require("apollo-server-express");
const { ApolloServerPluginDrainHttpServer } = require("apollo-server-core");
const { makeExecutableSchema } = require("@graphql-tools/schema");
const express = require("express");
const http = require("http");

const jwt = require("jsonwebtoken");

const JWT_SECRET = "TOP_SECRET";

const mongoose = require("mongoose");

const User = require("./models/user");

const typeDefs = require("./schema");
const resolvers = require("./resolvers");

const MONGODB_URI =
	"mongodb+srv://libraryApp:libraryApp@cluster0.kcoos1o.mongodb.net/libraryApp?retryWrites=true&w=majority";

console.log("connecting to", MONGODB_URI);

mongoose
	.connect(MONGODB_URI)
	.then(() => {
		console.log("connected to MongoDB");
	})
	.catch((error) => {
		console.log("error connection to MongoDB: ", error.message);
	});

const start = async () => {
	const app = express();
	const httpServer = http.createServer(app);

	const schema = makeExecutableSchema({ typeDefs, resolvers });

	// server
	const server = new ApolloServer({
		typeDefs,
		resolvers,
		context: async ({ req }) => {
			const auth = req ? req.headers.authorization : null;

			if (auth && auth.toLowerCase().startsWith("bearer ")) {
				const decodedToken = jwt.verify(auth.substring(7), JWT_SECRET);

				const currentUser = await User.findById(decodedToken.id);
				console.log("currentUser", currentUser);
				return { currentUser };
			}
		}, // context ends
		plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
	}); // server ends

	await server.start();

	server.applyMiddleware({
		app,
		path: "/",
	});

	const PORT = 4000;

	httpServer.listen(PORT, () =>
		console.log(`Server is now running on http://localhost:${PORT}`),
	);
}; // start func ends

start();
