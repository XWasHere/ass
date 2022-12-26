/**
 * Developer API
 * - Users
 * - Resources
 */

import { Router, Request, Response, NextFunction } from 'express';
import { findFromToken, setUserPassword, users, createNewUser, deleteUser, setUserMeta, deleteUserMeta, setUsername, resetToken, verifyCliKey } from '../auth';
import { log } from '../utils';
import { data } from '../data';
import { User } from '../types/auth';

/**
 * The primary API router
 */
const RouterApi = Router();

/**
 * Logs an error and sends a 500 (404 if 'User not found' error)
 * @since v0.14.1
 */
const errorHandler = (res: Response, err: Error | any) => {
	log.error(err);

	// Get the status code for the Response
	let code: number;
	switch (err.message) {
		case 'User not found':
			code = 404; break;
		case 'Meta key already exists':
		case 'Username already taken':
			code = 409; break;
		default:
			code = 500;
	}

	return res.status(code).type('text').send(err.message ?? err);
};

/**
 * Token authentication middleware for Admins
 * @since v0.14.0
 */
const adminAuthMiddleware = (req: Request, res: Response, next: NextFunction) => {
	const user = findFromToken(req.headers.authorization ?? '');
	(verifyCliKey(req) || (user && user.admin)) ? next() : res.sendStatus(401);
};

/**
 * Simple function to either return JSON or a 404, so I don't have to write it 40 times.
 * @since v0.14.0
 */
const userFinder = (res: Response, user: User | undefined) => user ? res.json(user) : res.sendStatus(404);

function buildUserRouter() {
	const userRouter = Router();

	// Index/Get all users
	// Admin only
	userRouter.get('/', adminAuthMiddleware, (req: Request, res: Response) => res.json(users));

	// Get self
	userRouter.get('/self', (req: Request, res: Response) =>
		userFinder(res, findFromToken(req.headers['authorization'] ?? '') ?? undefined));

	// Get user by token
	userRouter.get('/token/:token', (req: Request, res: Response) =>
		userFinder(res, users.find(user => user.token === req.params.token)));

	// Reset password (new plaintext password in form data; HOST SHOULD BE USING HTTPS)
	// Admin only
	// todo: user-resets using existing password
	userRouter.post('/password/reset/:id', adminAuthMiddleware, (req: Request, res: Response) => {
		const id = req.params.id;
		const newPassword = req.body.password;

		setUserPassword(id, newPassword)
			.then(() => res.sendStatus(200))
			.catch((err) => errorHandler(res, err));
	});

	// Create a new user
	// Admin only
	userRouter.post('/', adminAuthMiddleware, (req: Request, res: Response) => {
		const username: string | undefined = req.body.username;
		const password: string | undefined = req.body.password;
		const admin = req.body.admin ?? false;
		const meta: any = req.body.meta ?? {};

		// Block if username or password is empty, or if username is already taken
		if (username == null || username.length === 0 || password == null || password.length == 0 || users.find(user => user.username === username))
			return res.sendStatus(400);

		createNewUser(username, password, admin, meta)
			.then((user) => res.send(user))
			.catch((err) => errorHandler(res, err));
	});

	// Get a user (must be last as it's a catch-all)
	// Admin only
	userRouter.get('/:id', adminAuthMiddleware, (req: Request, res: Response) =>
		userFinder(res, users.find(user => user.unid === req.params.id || user.username === req.params.id)));

	// Delete a user
	// Admin only
	userRouter.delete('/:id', adminAuthMiddleware, (req: Request, res: Response) => {
		const id = req.params.id;

		deleteUser(id)
			.then(() => res.sendStatus(200))
			.catch((err) => errorHandler(res, err));
	});

	// Update a user meta key/value (/meta can be after /:id because they are not HTTP GET)
	// Admin only
	userRouter.put('/meta/:id', adminAuthMiddleware, (req: Request, res: Response) => {
		const id = req.params.id;
		const key: string | undefined = req.body.key;
		const value: any = req.body.value;
		const force = req.body.force ?? false;

		if (key == null || key.length === 0 || value == null || value.length === 0)
			return res.sendStatus(400);

		setUserMeta(id, key, value, force)
			.then(() => res.sendStatus(200))
			.catch((err) => errorHandler(res, err));
	});

	// Delete a user meta key
	// Admin only
	userRouter.delete('/meta/:id', adminAuthMiddleware, (req: Request, res: Response) => {
		const id = req.params.id;
		const key: string | undefined = req.body.key;

		if (key == null || key.length === 0)
			return res.sendStatus(400);

		deleteUserMeta(id, key)
			.then(() => res.sendStatus(200))
			.catch((err) => errorHandler(res, err));
	});

	// Sets a username
	// Admin only
	// todo: allow users to change their own username
	userRouter.put('/username/:id', adminAuthMiddleware, (req: Request, res: Response) => {
		const id = req.params.id;
		const username: string | undefined = req.body.username;

		if (username == null || username.length === 0)
			return res.sendStatus(400);

		setUsername(id, username)
			.then(() => res.sendStatus(200))
			.catch((err) => errorHandler(res, err));
	});

	// Resets a token
	// Admin only
	// todo: allow users to reset their own token
	userRouter.put('/token/:id', adminAuthMiddleware, (req: Request, res: Response) => {
		const id = req.params.id;

		resetToken(id)
			.then(() => res.sendStatus(200))
			.catch((err) => errorHandler(res, err));
	});

	return userRouter;
}

function buildResourceRouter() {
	const resourceRouter = Router();

	return resourceRouter;
}

export const onStart = () => {
	RouterApi.use('/user', buildUserRouter());
	RouterApi.use('/resource', buildResourceRouter());

	return RouterApi;
};