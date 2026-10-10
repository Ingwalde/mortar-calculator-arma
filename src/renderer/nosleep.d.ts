declare module "nosleep.js/dist/NoSleep.min.js" {
  export default class NoSleep {
    constructor();
    get isEnabled(): boolean;
    enable(): Promise<unknown>;
    disable(): void;
  }
}
