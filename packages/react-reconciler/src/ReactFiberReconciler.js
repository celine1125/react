/**
 * Copyright (c) 2013-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type {Fiber} from './ReactFiber';
import type {FiberRoot} from './ReactFiberRoot';
import type {ReactNodeList} from 'shared/ReactTypes';
import type {ExpirationTime} from './ReactFiberExpirationTime';

import {
  findCurrentHostFiber,
  findCurrentHostFiberWithNoPortals,
} from 'react-reconciler/reflection';
import * as ReactInstanceMap from 'shared/ReactInstanceMap';
import {HostComponent} from 'shared/ReactTypeOfWork';
import emptyObject from 'fbjs/lib/emptyObject';
import getComponentName from 'shared/getComponentName';
import invariant from 'fbjs/lib/invariant';
import warning from 'fbjs/lib/warning';

import {createFiberRoot} from './ReactFiberRoot';
import * as ReactFiberDevToolsHook from './ReactFiberDevToolsHook';
import ReactFiberScheduler from './ReactFiberScheduler';
import {createUpdate, enqueueUpdate} from './ReactUpdateQueue';
import ReactFiberInstrumentation from './ReactFiberInstrumentation';
import ReactDebugCurrentFiber from './ReactDebugCurrentFiber';

let didWarnAboutNestedUpdates;

if (__DEV__) {
  didWarnAboutNestedUpdates = false;
}

export type Deadline = {
  timeRemaining: () => number,
  didTimeout: boolean,
};

type OpaqueHandle = Fiber;
type OpaqueRoot = FiberRoot;

export type HostConfig<T, P, I, TI, HI, PI, C, CC, CX, PL> = {
  getRootHostContext(rootContainerInstance: C): CX,
  getChildHostContext(parentHostContext: CX, type: T, instance: C): CX,
  getPublicInstance(instance: I | TI): PI,

  createInstance(
    type: T,
    props: P,
    rootContainerInstance: C,
    hostContext: CX,
    internalInstanceHandle: OpaqueHandle,
  ): I,
  appendInitialChild(parentInstance: I, child: I | TI): void,
  finalizeInitialChildren(
    parentInstance: I,
    type: T,
    props: P,
    rootContainerInstance: C,
    hostContext: CX,
  ): boolean,

  prepareUpdate(
    instance: I,
    type: T,
    oldProps: P,
    newProps: P,
    rootContainerInstance: C,
    hostContext: CX,
  ): null | PL,

  shouldSetTextContent(type: T, props: P): boolean,
  shouldDeprioritizeSubtree(type: T, props: P): boolean,

  createTextInstance(
    text: string,
    rootContainerInstance: C,
    hostContext: CX,
    internalInstanceHandle: OpaqueHandle,
  ): TI,

  scheduleDeferredCallback(
    callback: (deadline: Deadline) => void,
    options?: {timeout: number},
  ): number,
  cancelDeferredCallback(callbackID: number): void,

  prepareForCommit(containerInfo: C): void,
  resetAfterCommit(containerInfo: C): void,

  now(): number,

  +hydration?: HydrationHostConfig<T, P, I, TI, HI, C, CX, PL>,

  +mutation?: MutableUpdatesHostConfig<T, P, I, TI, C, PL>,
  +persistence?: PersistentUpdatesHostConfig<T, P, I, TI, C, CC, PL>,
};

type MutableUpdatesHostConfig<T, P, I, TI, C, PL> = {
  commitUpdate(
    instance: I,
    updatePayload: PL,
    type: T,
    oldProps: P,
    newProps: P,
    internalInstanceHandle: OpaqueHandle,
  ): void,
  commitMount(
    instance: I,
    type: T,
    newProps: P,
    internalInstanceHandle: OpaqueHandle,
  ): void,
  commitTextUpdate(textInstance: TI, oldText: string, newText: string): void,
  resetTextContent(instance: I): void,
  appendChild(parentInstance: I, child: I | TI): void,
  appendChildToContainer(container: C, child: I | TI): void,
  insertBefore(parentInstance: I, child: I | TI, beforeChild: I | TI): void,
  insertInContainerBefore(
    container: C,
    child: I | TI,
    beforeChild: I | TI,
  ): void,
  removeChild(parentInstance: I, child: I | TI): void,
  removeChildFromContainer(container: C, child: I | TI): void,
};

type PersistentUpdatesHostConfig<T, P, I, TI, C, CC, PL> = {
  cloneInstance(
    instance: I,
    updatePayload: null | PL,
    type: T,
    oldProps: P,
    newProps: P,
    internalInstanceHandle: OpaqueHandle,
    keepChildren: boolean,
    recyclableInstance: I,
  ): I,

  createContainerChildSet(container: C): CC,

  appendChildToContainerChildSet(childSet: CC, child: I | TI): void,
  finalizeContainerChildren(container: C, newChildren: CC): void,

  replaceContainerChildren(container: C, newChildren: CC): void,
};

type HydrationHostConfig<T, P, I, TI, HI, C, CX, PL> = {
  // Optional hydration
  canHydrateInstance(instance: HI, type: T, props: P): null | I,
  canHydrateTextInstance(instance: HI, text: string): null | TI,
  getNextHydratableSibling(instance: I | TI | HI): null | HI,
  getFirstHydratableChild(parentInstance: I | C): null | HI,
  hydrateInstance(
    instance: I,
    type: T,
    props: P,
    rootContainerInstance: C,
    hostContext: CX,
    internalInstanceHandle: OpaqueHandle,
  ): null | PL,
  hydrateTextInstance(
    textInstance: TI,
    text: string,
    internalInstanceHandle: OpaqueHandle,
  ): boolean,
  didNotMatchHydratedContainerTextInstance(
    parentContainer: C,
    textInstance: TI,
    text: string,
  ): void,
  didNotMatchHydratedTextInstance(
    parentType: T,
    parentProps: P,
    parentInstance: I,
    textInstance: TI,
    text: string,
  ): void,
  didNotHydrateContainerInstance(parentContainer: C, instance: I | TI): void,
  didNotHydrateInstance(
    parentType: T,
    parentProps: P,
    parentInstance: I,
    instance: I | TI,
  ): void,
  didNotFindHydratableContainerInstance(
    parentContainer: C,
    type: T,
    props: P,
  ): void,
  didNotFindHydratableContainerTextInstance(
    parentContainer: C,
    text: string,
  ): void,
  didNotFindHydratableInstance(
    parentType: T,
    parentProps: P,
    parentInstance: I,
    type: T,
    props: P,
  ): void,
  didNotFindHydratableTextInstance(
    parentType: T,
    parentProps: P,
    parentInstance: I,
    text: string,
  ): void,
};

// 0 is PROD, 1 is DEV.
// Might add PROFILE later.
type BundleType = 0 | 1;

type DevToolsConfig<I, TI> = {|
  bundleType: BundleType,
  version: string,
  rendererPackageName: string,
  // Note: this actually *does* depend on Fiber internal fields.
  // Used by "inspect clicked DOM element" in React DevTools.
  findFiberByHostInstance?: (instance: I | TI) => Fiber,
  // Used by RN in-app inspector.
  // This API is unfortunately RN-specific.
  // TODO: Change it to accept Fiber instead and type it properly.
  getInspectorDataForViewTag?: (tag: number) => Object,
|};

export type Reconciler<C, I, TI> = {
  createContainer(
    containerInfo: C,
    isAsync: boolean,
    hydrate: boolean,
  ): OpaqueRoot,
  updateContainer(
    element: ReactNodeList,
    container: OpaqueRoot,
    parentComponent: ?React$Component<any, any>,
    callback: ?Function,
  ): ExpirationTime,
  updateContainerAtExpirationTime(
    element: ReactNodeList,
    container: OpaqueRoot,
    parentComponent: ?React$Component<any, any>,
    expirationTime: ExpirationTime,
    callback: ?Function,
  ): ExpirationTime,
  flushRoot(root: OpaqueRoot, expirationTime: ExpirationTime): void,
  requestWork(root: OpaqueRoot, expirationTime: ExpirationTime): void,
  batchedUpdates<A>(fn: () => A): A,
  unbatchedUpdates<A>(fn: () => A): A,
  flushSync<A>(fn: () => A): A,
  flushControlled(fn: () => mixed): void,
  deferredUpdates<A>(fn: () => A): A,
  interactiveUpdates<A>(fn: () => A): A,
  injectIntoDevTools(devToolsConfig: DevToolsConfig<I, TI>): boolean,
  computeUniqueAsyncExpiration(): ExpirationTime,

  // Used to extract the return value from the initial render. Legacy API.
  getPublicRootInstance(
    container: OpaqueRoot,
  ): React$Component<any, any> | TI | I | null,

  // Use for findDOMNode/findHostNode. Legacy API.
  findHostInstance(component: Object): I | TI | null,

  // Used internally for filtering out portals. Legacy API.
  findHostInstanceWithNoPortals(component: Fiber): I | TI | null,
};

export default function<T, P, I, TI, HI, PI, C, CC, CX, PL>(
  config: HostConfig<T, P, I, TI, HI, PI, C, CC, CX, PL>,
): Reconciler<C, I, TI> {
  const {getPublicInstance} = config;

  const {
    computeUniqueAsyncExpiration,
    recalculateCurrentTime,
    computeExpirationForFiber,
    scheduleWork,
    requestWork,
    flushRoot,
    batchedUpdates,
    unbatchedUpdates,
    flushSync,
    flushControlled,
    deferredUpdates,
    syncUpdates,
    interactiveUpdates,
    flushInteractiveUpdates,
    legacyContext,
  } = ReactFiberScheduler(config);

  const {
    findCurrentUnmaskedContext,
    isContextProvider,
    processChildContext,
  } = legacyContext;

  function getContextForSubtree(
    parentComponent: ?React$Component<any, any>,
  ): Object {
    if (!parentComponent) {
      return emptyObject;
    }

    const fiber = ReactInstanceMap.get(parentComponent);
    const parentContext = findCurrentUnmaskedContext(fiber);
    return isContextProvider(fiber)
      ? processChildContext(fiber, parentContext)
      : parentContext;
  }

  function scheduleRootUpdate(
    current: Fiber,
    element: ReactNodeList,
    currentTime: ExpirationTime,
    expirationTime: ExpirationTime,
    callback: ?Function,
  ) {
    if (__DEV__) {
      if (
        ReactDebugCurrentFiber.phase === 'render' &&
        ReactDebugCurrentFiber.current !== null &&
        !didWarnAboutNestedUpdates
      ) {
        didWarnAboutNestedUpdates = true;
        warning(
          false,
          'Render methods should be a pure function of props and state; ' +
            'triggering nested component updates from render is not allowed. ' +
            'If necessary, trigger nested updates in componentDidUpdate.\n\n' +
            'Check the render method of %s.',
          getComponentName(ReactDebugCurrentFiber.current) || 'Unknown',
        );
      }
    }

    const update = createUpdate(expirationTime);
    update.payload = {children: element};

    callback = callback === undefined ? null : callback;
    if (callback !== null) {
      warning(
        typeof callback === 'function',
        'render(...): Expected the last optional `callback` argument to be a ' +
          'function. Instead received: %s.',
        callback,
      );
      update.callback = callback;
    }
    enqueueUpdate(current, update, expirationTime);

    scheduleWork(current, expirationTime);
    return expirationTime;
  }

  function updateContainerAtExpirationTime(
    element: ReactNodeList,
    container: OpaqueRoot,
    parentComponent: ?React$Component<any, any>,
    currentTime: ExpirationTime,
    expirationTime: ExpirationTime,
    callback: ?Function,
  ) {
    // TODO: If this is a nested container, this won't be the root.
    const current = container.current;

    if (__DEV__) {
      if (ReactFiberInstrumentation.debugTool) {
        if (current.alternate === null) {
          ReactFiberInstrumentation.debugTool.onMountContainer(container);
        } else if (element === null) {
          ReactFiberInstrumentation.debugTool.onUnmountContainer(container);
        } else {
          ReactFiberInstrumentation.debugTool.onUpdateContainer(container);
        }
      }
    }

    const context = getContextForSubtree(parentComponent);
    if (container.context === null) {
      container.context = context;
    } else {
      container.pendingContext = context;
    }

    return scheduleRootUpdate(
      current,
      element,
      currentTime,
      expirationTime,
      callback,
    );
  }

  function findHostInstance(component: Object): PI | null {
    const fiber = ReactInstanceMap.get(component);
    if (fiber === undefined) {
      if (typeof component.render === 'function') {
        invariant(false, 'Unable to find node on an unmounted component.');
      } else {
        invariant(
          false,
          'Argument appears to not be a ReactComponent. Keys: %s',
          Object.keys(component),
        );
      }
    }
    const hostFiber = findCurrentHostFiber(fiber);
    if (hostFiber === null) {
      return null;
    }
    return hostFiber.stateNode;
  }

  return {
    createContainer(
      containerInfo: C,
      isAsync: boolean,
      hydrate: boolean,
    ): OpaqueRoot {
      return createFiberRoot(containerInfo, isAsync, hydrate);
    },

    updateContainer(
      element: ReactNodeList,
      container: OpaqueRoot,
      parentComponent: ?React$Component<any, any>,
      callback: ?Function,
    ): ExpirationTime {
      const current = container.current;
      const currentTime = recalculateCurrentTime();
      const expirationTime = computeExpirationForFiber(current);
      return updateContainerAtExpirationTime(
        element,
        container,
        parentComponent,
        currentTime,
        expirationTime,
        callback,
      );
    },

    updateContainerAtExpirationTime(
      element,
      container,
      parentComponent,
      expirationTime,
      callback,
    ) {
      const currentTime = recalculateCurrentTime();
      return updateContainerAtExpirationTime(
        element,
        container,
        parentComponent,
        currentTime,
        expirationTime,
        callback,
      );
    },

    flushRoot,

    requestWork,

    computeUniqueAsyncExpiration,

    batchedUpdates,

    unbatchedUpdates,

    deferredUpdates,

    syncUpdates,

    interactiveUpdates,

    flushInteractiveUpdates,

    flushControlled,

    flushSync,

    getPublicRootInstance(
      container: OpaqueRoot,
    ): React$Component<any, any> | PI | null {
      const containerFiber = container.current;
      if (!containerFiber.child) {
        return null;
      }
      switch (containerFiber.child.tag) {
        case HostComponent:
          return getPublicInstance(containerFiber.child.stateNode);
        default:
          return containerFiber.child.stateNode;
      }
    },

    findHostInstance,

    findHostInstanceWithNoPortals(fiber: Fiber): PI | null {
      const hostFiber = findCurrentHostFiberWithNoPortals(fiber);
      if (hostFiber === null) {
        return null;
      }
      return hostFiber.stateNode;
    },

    injectIntoDevTools(devToolsConfig: DevToolsConfig<I, TI>): boolean {
      const {findFiberByHostInstance} = devToolsConfig;
      return ReactFiberDevToolsHook.injectInternals({
        ...devToolsConfig,
        findHostInstanceByFiber(fiber: Fiber): I | TI | null {
          const hostFiber = findCurrentHostFiber(fiber);
          if (hostFiber === null) {
            return null;
          }
          return hostFiber.stateNode;
        },
        findFiberByHostInstance(instance: I | TI): Fiber | null {
          if (!findFiberByHostInstance) {
            // Might not be implemented by the renderer.
            return null;
          }
          return findFiberByHostInstance(instance);
        },
      });
    },
  };
}
