import { Store } from 'redux';
import { injectable, interfaces, inject } from 'inversify';
import { MicroModule, MicroOrchestratorTypes } from '@uprtcl/micro-orchestrator';
import {
  CortexTypes,
  DiscoveryService,
  DiscoverableSource,
  ValidateHash,
  TransformHash,
  DefaultSignedPattern,
  DefaultSecuredPattern,
  ValidatePattern,
  TransformPattern,
  HashedPattern,
  SecuredPattern,
  PatternTypes,
  SignedPattern,
  Hashed,
  Secured
} from '@uprtcl/cortex';

import { PerspectivePattern } from './patterns/perspective.pattern';
import { CommitPattern } from './patterns/commit.pattern';
import { ContextPattern } from './patterns/context.pattern';
import { CommitHistory } from './lenses/commit-history';
import { UprtclTypes } from './types';
import { UprtclProvider } from './services/uprtcl/uprtcl.provider';

export function uprtclModule(discoverableUprtcl: DiscoverableSource<UprtclProvider>): any {
  @injectable()
  class UprtclModule implements MicroModule {
    async onLoad(
      bind: interfaces.Bind,
      unbind: interfaces.Unbind,
      isBound: interfaces.IsBound,
      rebind: interfaces.Rebind
    ): Promise<void> {
      bind<DiscoverableSource>(CortexTypes.DiscoverableSource).toConstantValue(discoverableUprtcl);
      bind<UprtclProvider>(UprtclTypes.UprtclProvider).toConstantValue(discoverableUprtcl.source);

      // Patterns

      bind<HashedPattern<any>>(PatternTypes.Hashed).to(ValidateHash);
      bind<HashedPattern<any>>(CortexTypes.Pattern).to(ValidateHash);

      bind<TransformPattern<Hashed<any>, [any]>>(PatternTypes.Hashed).to(TransformHash);
      bind<TransformPattern<Hashed<any>, [any]>>(CortexTypes.Pattern).to(TransformHash);

      bind<SignedPattern<any>>(PatternTypes.Signed).to(DefaultSignedPattern);
      bind<SignedPattern<any>>(CortexTypes.Pattern).to(DefaultSignedPattern);

      bind<SecuredPattern<Secured<any>>>(PatternTypes.Secured).to(DefaultSecuredPattern);
      bind<SecuredPattern<Secured<any>>>(CortexTypes.Pattern).to(DefaultSecuredPattern);

      bind<PerspectivePattern>(UprtclTypes.PerspectivePattern).to(PerspectivePattern);
      bind<CommitPattern>(UprtclTypes.CommitPattern).to(CommitPattern);
      bind<ContextPattern>(UprtclTypes.ContextPattern).to(ContextPattern);

      bind<PerspectivePattern>(CortexTypes.Pattern).to(PerspectivePattern);
      bind<CommitPattern>(CortexTypes.Pattern).to(CommitPattern);
      bind<ContextPattern>(CortexTypes.Pattern).to(ContextPattern);

      customElements.define('commit-history', CommitHistory);
    }

    async onUnload(): Promise<void> {}
  }

  return UprtclModule;
}
