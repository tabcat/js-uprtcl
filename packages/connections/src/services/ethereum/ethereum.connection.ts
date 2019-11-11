import Web3 from 'web3';
import { provider } from 'web3-core';

import { Connection, ConnectionOptions } from '../../connections/connection';

export interface EthereumConnectionOptions {
  provider?: provider;
}

export class EthereumConnection extends Connection {
  web3!: Web3;
  accounts!: string[];
  networkId!: number;

  constructor(protected ethOptions: EthereumConnectionOptions, options: ConnectionOptions) {
    super(options);
  }

  /**
   * @override
   */
  protected async connect(): Promise<void> {
    let provider = window['ethereum'];

    if (this.ethOptions.provider) {
      this.web3 = new Web3(this.ethOptions.provider);
    } else if (typeof provider !== 'undefined') {
      this.accounts = await provider.enable();
      this.web3 = new Web3(provider);
    } else {
      throw new Error('No available web3 provider was found');
    }

    console.log(this.web3.eth.accounts);

    setInterval(async () => {
      const accounts = await this.web3.eth.getAccounts();
      this.updateAccounts(accounts);
    }, 100);

    const accounts = await this.web3.eth.getAccounts();
    this.updateAccounts(accounts);

    this.networkId = await this.web3.eth.net.getId();
  }

  private updateAccounts(accounts: string[]): void {
    this.accounts = accounts;
  }

  /**
   * @returns the current used account for this ethereum connection
   */
  public getCurrentAccount(): string {
    return this.accounts[0];
  }
}
