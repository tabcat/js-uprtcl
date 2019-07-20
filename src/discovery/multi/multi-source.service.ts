import { Source } from '../sources/source';
import { LinkedPattern } from '../../patterns/patterns/linked.pattern';
import { Dictionary } from 'lodash';
import { DiscoverableSource } from '../sources/discoverable.source';
import { KnownSourcesService } from '../known-sources/known-sources.service';
import PatternRegistry from '../../patterns/registry/pattern.registry';

export class MultiSourceService<T extends Source = Source> implements Source {
  sources!: Dictionary<DiscoverableSource<T>>;

  private initialization: Promise<void>;
  private initCompleted: boolean = false;

  /**
   * @param patternRegistry the pattern registry to interact with the objects and their links
   * @param knownSources local service to store all known sources to be able to retrieve the object afterwards
   * @param discoverableSources array of all discoverable sources from which to get objects
   */
  constructor(
    protected patternRegistry: PatternRegistry,
    protected localKnownSources: KnownSourcesService,
    discoverableSources: Array<DiscoverableSource<T>>
  ) {
    this.initialization = this.initSources(discoverableSources);
  }

  /**
   * Initialize the sources by calling getOwnSource() on each discoverable source
   *
   * @param discoverableSources
   * @returns a promise that resolves when all the sources have been initialized
   */
  private async initSources(discoverableSources: Array<DiscoverableSource<T>>): Promise<void> {
    // Get the name of each source
    const promises = discoverableSources.map(source => source.knownSources.getOwnSource());
    const sourcesNames = await Promise.all(promises);

    // Build the sources dictionary from the resulting names
    this.sources = sourcesNames.reduce(
      (sources, sourceName, index) => ({ ...sources, [sourceName]: sources[index] }),
      {}
    );

    // Set initialization completed
    this.initCompleted = true;
  }

  /**
   * @returns a promise that resolves when all the sources have been initialized
   */
  protected ready(): Promise<void> {
    if (this.initCompleted) return Promise.resolve();
    else return this.initialization;
  }

  /**
   * Gets the source with the given name
   *
   * @param sourceName the name of the source
   * @returns the source identified with the given name
   */
  public getSource(sourceName: string): T {
    return this.sources[sourceName].source;
  }

  /**
   * @returns gets the names of all the sources
   */
  public getAllSources(): string[] {
    return Object.keys(this.sources);
  }

  /**
   * Retrieves the known sources for the given hash from the given source and stores them in the known sources service
   * @param hash the hash for which to discover the sources
   * @param source the source to ask for the known sources
   */
  protected async discoverKnownSources(hash: string, source: string): Promise<void> {
    const knownSourcesService = this.sources[source].knownSources;

    const sources = await knownSourcesService.getKnownSources(hash);

    if (sources) {
      await this.localKnownSources.addKnownSources(hash, sources);
    }
  }

  /**
   * Gets the object for the given hash from the given source
   *
   * @param hash the object hash
   * @param source the source from which to get the object from
   * @returns the object if found, otherwise undefined
   */
  protected async getFromSource<O extends object>(
    hash: string,
    source: string
  ): Promise<O | undefined> {
    // Get the object from source
    const object = await this.getSource(source).get<O>(hash);

    if (object) {
      // Object retrieved, discover the sources for its links
      const pattern = this.patternRegistry.from(object) as LinkedPattern<O>;

      if (pattern.hasOwnProperty('getLinks')) {
        const links = await pattern.getLinks(object);
        const promises = links.map(link => this.discoverKnownSources(link, source));

        await Promise.all(promises);
      }
    } else {
      // Object retrieval succeeded but object was not found,
      // remove from the known sources
      await this.localKnownSources.removeKnownSource(hash, source);
    }

    return object;
  }

  /**
   * Tries to get the object from the given source and rejects if object is not found
   *
   * @param hash the hash of the object
   * @param source the source to get the object from
   * @returns the object if found, rejects if not found
   */
  protected async tryGetFromSource<O extends object>(hash: string, source: string): Promise<O> {
    const object = await this.getFromSource<O>(hash, source);

    // Reject if object is not found
    if (object === undefined) {
      return Promise.reject();
    }

    return object;
  }

  /**
   * Retrieves the object with the given hash
   *
   * @param hash the hash of the object to retrieve
   * @returns the object if found, otherwise undefined
   */
  public async get<O extends object>(hash: string): Promise<O | undefined> {
    // Wait for the sources to have been initialized
    await this.ready();

    // Get the known sources for the object from the local
    const knownSources = await this.localKnownSources.getKnownSources(hash);

    let promises: Array<Promise<O>>;
    if (knownSources) {
      // Try to retrieve the object from any of the known sources

      promises = knownSources.map(source => this.tryGetFromSource<O>(hash, source));
    } else {
      // We had no known sources for the hash, try to get the object from all the sources
      const allSources = this.getAllSources();

      promises = allSources.map(async source => {
        const object = await this.tryGetFromSource<O>(hash, source);

        // Luckily we found the object in one of the sources, store it in the known sources
        await this.localKnownSources.addKnownSources(hash, [source]);
        return object;
      });
    }

    try {
      // Get first resolved object
      const object = await this.raceToSuccess<O>(promises);
      return object;
    } catch (e) {
      // All sources failed, return undefined
      return undefined;
    }
  }

  /**
   * Execute the promises in parallel and return when the first promise resolves
   * Only reject if all promises rejected
   *
   * @param promises array of promises to execute
   * @returns the first resolved promise, or rejects if all promises rejected
   */
  private raceToSuccess<O>(promises: Array<Promise<O>>): Promise<O> {
    let numRejected = 0;

    return new Promise((resolve, reject) =>
      promises.forEach(promise =>
        promise.then(resolve).catch(() => {
          if (++numRejected === promises.length) reject();
        })
      )
    );
  }
}
