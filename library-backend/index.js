const {
	ApolloServer,
	gql,
	UserInputError,
	AuthenticationError,
} = require("apollo-server");

const jwt = require("jsonwebtoken");

const JWT_SECRET = "TOP_SECRET";

const mongoose = require("mongoose");

const Book = require("./models/book");
const Author = require("./models/author");
const User = require("./models/user");

const typeDefs = require("./schema");

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

const resolvers = {
	Query: {
		authorCount: async () => Author.collection.countDocuments(),
		bookCount: async () => Book.collection.countDocuments(),
		allAuthors: async () => {
			return Author.find({});
		},
		allBooks: async (root, args) => {
			console.log("args.genre", args.genre);
			if (!args.author && !args.genre) {
				return Book.find({}).populate("author", { name: 1 });
			}
			if (!args.author && args.genre) {
				const books = await Book.find({
					genres: { $in: [args.genre] },
				}).populate("author");
				console.log("books", books);
				return books;
			}
			if (args.author && !args.genre) {
				return Book.find({ author: { $in: [args.author] } });
			}
			if (args.author && args.genre) {
				return Book.find({
					author: { $in: [args.author] },
					genres: { $in: [args.genre] },
				});
			}
		},
		me: (root, args, context) => {
			return context.currentUser;
		},
	},
	Author: {
		bookCount: async (root) => {
			const booksByAuthor = await Book.find({ author: root.id });

			return booksByAuthor.length;
		},
	},

	Mutation: {
		addBook: async (root, args, context) => {
			const currentUser = context.currentUser;

			if (!currentUser) {
				throw new AuthenticationError("not authenticated");
			}
			if (args.title.length < 2) {
				throw new UserInputError(
					"book title must be at least 2 character long",
				);
			}
			if (args.author.length < 4) {
				throw new UserInputError(
					"author name must be at least 4 character long",
				);
			}

			let author = await Author.findOne({ name: args.author });

			if (!author) {
				const newAuthor = new Author({ name: args.author });

				try {
					author = await newAuthor.save();
					console.log("author", author);
				} catch (error) {
					throw new UserInputError(error.message, {
						invalidArgs: args,
					});
				}
			}

			const book = new Book({ ...args, author: author });

			try {
				await book.save();
			} catch (error) {
				throw new UserInputError(error.message, {
					invalidArgs: args,
				});
			}
			console.log("book", book);
			return book;
		},

		editAuthor: async (root, args, { currentUser }) => {
			if (!currentUser) {
				throw new AuthenticationError("not authenticated");
			}

			const author = await Author.findOne({ name: args.name });
			if (!author) {
				return null;
			}

			author.born = args.setBornTo;
			try {
				await author.save();
			} catch (error) {
				throw new UserInputError(error.message, {
					invalidArgs: args,
				});
			}
			return author;
		},

		// resolver of createUser mutation
		createUser: async (root, args) => {
			const user = new User({
				username: args.username,
				favoriteGenre: args.favoriteGenre,
			});
			return user.save().catch((error) => {
				throw new UserInputError(error.message, {
					invalidArgs: args,
				});
			});
		},

		// resolver of login mutation
		login: async (root, args) => {
			const user = await User.findOne({ username: args.username });

			if (!user || args.password !== "secret") {
				throw new UserInputError("wrong credentials");
			}

			const userForToken = {
				username: user.username,
				id: user._id,
			};
			return { value: jwt.sign(userForToken, JWT_SECRET) };
		},
	},
};

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
	},
});

server.listen().then(({ url }) => {
	console.log(`Server ready at ${url}`);
});
