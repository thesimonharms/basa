import { ServiceProvider } from '@mudah-cli/mudah';

export default class BasaProvider extends ServiceProvider {
  register(): void {
    this.app.config().merge('app', {
      name: 'basa',
      env: 'local',
      // Default location for user decks (~/.config/basa/decks).
      decksDir: '~/basa/decks',
      // Optional sound effects: 'on' | 'off' | 'auto'.
      sound: 'auto',
    });
  }
}
