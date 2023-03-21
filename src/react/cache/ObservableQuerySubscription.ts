import equal from '@wry/equality';
import { ApolloQueryResult, ObservableQuery } from '../../core';
import { Concast, hasDirectives } from '../../utilities';

type Listener<TData> = (result: ApolloQueryResult<TData>) => void;

interface Subscription {
  unsubscribe: () => void;
}

function maybeWrapConcastWithCustomPromise<TData>(
  concast: Concast<ApolloQueryResult<TData>>,
  { deferred }: { deferred: boolean }
) {
  if (deferred) {
    return new Promise<ApolloQueryResult<TData>>((resolve, reject) => {
      // Unlike `concast.promise`, we want to resolve the promise on the initial
      // chunk of the deferred query. This allows the component to unsuspend
      // when we get the initial set of data, rather than waiting until all
      // chunks have been loaded.
      const subscription = concast.subscribe({
        next: (value) => {
          resolve(value);
          subscription.unsubscribe();
        },
        error: reject,
      });
    });
  }

  return concast.promise;
}

export class ObservableQuerySubscription<TData = any> {
  public result: ApolloQueryResult<TData>;
  public promise: Promise<ApolloQueryResult<TData>>;
  public readonly observable: ObservableQuery<TData>;

  private subscription: Subscription;
  private listeners = new Set<Listener<TData>>();

  constructor(observable: ObservableQuery<TData>) {
    this.handleNext = this.handleNext.bind(this);
    this.observable = observable;
    this.result = observable.getCurrentResult();

    this.subscription = observable.subscribe({
      next: this.handleNext,
      error: this.handleNext,
    });

    this.promise = maybeWrapConcastWithCustomPromise(
      observable.reobserveAsConcast(),
      { deferred: hasDirectives(['defer'], observable.query) }
    );
  }

  subscribe(listener: Listener<TData>) {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  dispose() {
    this.listeners.clear();
    this.subscription.unsubscribe();
  }

  setResult(result: ApolloQueryResult<TData>) {
    if (!equal(this.result, result)) {
      this.result = result;
      this.deliver(result);
    }
  }

  private handleNext() {
    this.setResult(this.observable.getCurrentResult());
  }

  private deliver(result: ApolloQueryResult<TData>) {
    this.listeners.forEach((listener) => listener(result));
  }
}
