import AuthRepository from '../auth/auth.repository.js';

export default class UserController {

  static async getUser(req, res) {
    try {
      const { email } = req.token;

      console.log(email);

      const user = await AuthRepository.findUserByEmail(email);
      console.log(user);
      if (!user) {
        throw new Error('User not found');
      }


      return res.status(200).json({ user: { id: user.id, email: user.email } });



    } catch (error) {
      console.log('Error on getUser', error);
      return res.status(500).json({ message: "Internal server error" });
    }

  }
}
