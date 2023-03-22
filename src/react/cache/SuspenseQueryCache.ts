import { Trie } from '@wry/trie';
import {
  ApolloClient,
  DocumentNode,
  ObservableQuery,
  OperationVariables,
  TypedDocumentNode,
} from '../../core';
import { ObservableQuerySubscription } from './ObservableQuerySubscription';

import { canonicalStringify } from '../../cache';
import { canUseWeakMap } from '../../utilities';

export type CacheKey = [DocumentNode, string];

const EMPTY_VARIABLES = Object.create(null);

export class SuspenseQueryCache {
  private client: ApolloClient<unknown>;

  private cacheKeys = new Trie<CacheKey>(
    canUseWeakMap,
    (cacheKey: CacheKey) => cacheKey
  );

  private subscriptions = new Map<CacheKey, ObservableQuerySubscription>();

  constructor(client: ApolloClient<unknown>) {
    this.client = client;
  }

  getSubscription<TData = any>(
    query: DocumentNode | TypedDocumentNode<TData>,
    variables: OperationVariables | undefined,
    createObservable: (client: ApolloClient<unknown>) => ObservableQuery<TData>
  ) {
    const cacheKey = this.getCacheKey(query, variables);

    if (!this.subscriptions.has(cacheKey)) {
      this.subscriptions.set(
        cacheKey,
        new ObservableQuerySubscription(createObservable(this.client), {
          onDispose: () => this.subscriptions.delete(cacheKey),
        })
      );
    }

    return this.subscriptions.get(
      cacheKey
    )! as ObservableQuerySubscription<TData>;
  }

  private getCacheKey(
    query: DocumentNode,
    variables: OperationVariables | undefined
  ) {
    return this.cacheKeys.lookup(
      query,
      canonicalStringify(variables || EMPTY_VARIABLES)
    );
  }
}
