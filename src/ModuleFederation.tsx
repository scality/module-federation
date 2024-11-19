import {
  loadRemote,
  registerRemotes,
} from "@module-federation/enhanced/runtime";
import React, {
  FC,
  FunctionComponent,
  ReactNode,
  Suspense,
  createContext,
  lazy,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";
type Module = any;

const registeredApps: string[] = [];
export function registerAndLoadModule(
  scope: string,
  module: string,
  url: string
): () => Promise<Module> {
  if (registeredApps.includes(scope)) {
    return loadModule(scope, module);
  }

  registeredApps.push(scope);
  registerRemotes([
    {
      name: scope,
      entry: url,
    },
  ]);

  return loadModule(scope, module);
}

export function loadModule(
  scope: string,
  module: string
): () => Promise<Module> {
  return async () => {
    const moduleAbsolutePath = module.substring(1);

    const remoteUrl = `${scope}${moduleAbsolutePath}`;

    return loadRemote(remoteUrl);
  };
}

const CurrentAppContext = createContext<SolutionUI | null>(null);

export const useCurrentApp = () => {
  const contextValue = useContext(CurrentAppContext);

  if (contextValue === null) {
    throw new Error(
      "useCurrentApp can't be used outside of CurrentAppContext.Provider"
    );
  }

  return contextValue;
};

export type FederatedComponentProps = {
  url: string;
  scope: string;
  module: string;
};

export type SolutionUI = {
  kind: string;
  url: string;
  name: string;
  version: string;
  appHistoryBasePath: string;
};

export function FederatedComponent({
  url,
  scope,
  module,
  app,
  renderOnLoading,
  props,
}: FederatedComponentProps & {
  props: any;
  app: SolutionUI;
  renderOnLoading?: ReactNode;
}) {
  const Component = useMemo(() => {
    return lazy(registerAndLoadModule(scope, module, url));
  }, [scope, module, url]);

  if (!url || !scope || !module) {
    throw new Error("Can't federate a component without url, scope and module");
  }

  return (
    <Suspense fallback={renderOnLoading ?? <>Loading...</>}>
      <ShellHooksProvider
        shellHooks={props.shellHooks}
        shellAlerts={props.shellAlerts}
      >
        <CurrentAppContext.Provider value={app}>
          <Component {...props} />
        </CurrentAppContext.Provider>
      </ShellHooksProvider>
    </Suspense>
  );
}

export const lazyWithModules = <Props extends {}>(
  functionComponent: FunctionComponent<React.PropsWithChildren<Props>>,
  ...modules: { module: string; url: string; scope: string }[]
) => {
  return React.lazy(async () => {
    const loadedModules = await Promise.all(
      modules.map((mod) => {
        return registerAndLoadModule(mod.scope, mod.module, mod.url)();
      })
    );
    const moduleExports = loadedModules.reduce(
      (current, loadedModule, index) => ({
        ...current,
        [modules[index].module]: loadedModule,
      }),
      {}
    );
    return {
      __esModule: true,
      default: (originalProps: Props) =>
        functionComponent({ moduleExports: moduleExports, ...originalProps }),
    };
  });
};

export const ComponentWithFederatedImports = <Props extends {}>({
  renderOnError,
  renderOnLoading,
  componentWithInjectedImports,
  componentProps,
  federatedImports,
}: {
  renderOnError?: ReactNode;
  renderOnLoading?: ReactNode;
  componentWithInjectedImports: FunctionComponent<
    React.PropsWithChildren<Props> & { moduleExports: Record<string, unknown> }
  >;
  componentProps: Props;
  federatedImports: {
    remoteEntryUrl: string;
    scope: string;
    module: string;
  }[];
}) => {
  const Component = useMemo(
    () =>
      lazyWithModules(
        componentWithInjectedImports,
        ...federatedImports.map((federatedImport) => ({
          scope: federatedImport.scope,
          module: federatedImport.module,
          url: federatedImport.remoteEntryUrl,
        }))
      ),
    [JSON.stringify(federatedImports)]
  );

  return (
    <Suspense fallback={renderOnLoading ?? <>Loading...</>}>
      {/*@ts-expect-error*/}
      <Component {...componentProps} />
    </Suspense>
  );
};

type ShellHooks<T extends { shellHooks: any }> = T["shellHooks"];
type ShellAlerts<T extends { shellAlerts: any }> = T["shellAlerts"];

type Listener = () => void;

const createShellHooksStore = <T extends { shellHooks: any }>() => {
  let shellHooks: ShellHooks<T> | null = null;

  const listeners: Set<Listener> = new Set();

  return {
    getShellHooks: () => shellHooks,

    subscribe: (listener: Listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    setShellHooks: (newHooks: ShellHooks<T>) => {
      if (shellHooks !== newHooks) {
        shellHooks = newHooks;
        listeners.forEach((listener) => listener());
      }
    },
  };
};

const createShellAlertsStore = <T extends { shellAlerts: any }>() => {
  let shellAlerts: ShellAlerts<T> | null = null;
  const listeners: Set<Listener> = new Set();

  return {
    getShellAlerts: () => shellAlerts,

    subscribe: (listener: Listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    setShellAlerts: (newAlerts: ShellAlerts<T>) => {
      if (shellAlerts !== newAlerts) {
        shellAlerts = newAlerts;
        listeners.forEach((listener) => listener());
      }
    },
  };
};

export const shellHooksStore = createShellHooksStore();
export const shellAlertsStore = createShellAlertsStore();

export const useShellHooks = <
  T extends { shellHooks: any }
>(): ShellHooks<T> => {
  const hooks = useSyncExternalStore(
    shellHooksStore.subscribe,
    shellHooksStore.getShellHooks
  );

  if (!hooks) {
    throw new Error(
      "useShellHooks must be used within a ShellHooksProvider and initialized with valid hooks."
    );
  }

  return hooks;
};

export const useShellAlerts = <
  T extends { shellAlerts: any }
>(): ShellAlerts<T> => {
  const alerts = useSyncExternalStore(
    shellAlertsStore.subscribe,
    shellAlertsStore.getShellAlerts
  );

  if (!alerts) {
    throw new Error(
      "useShellAlerts must be used within a ShellHooksProvider and initialized with valid alerts."
    );
  }

  return alerts;
};

export const ShellHooksProvider = <
  T extends { shellHooks: any },
  K extends { shellAlerts: any }
>({
  shellHooks,
  shellAlerts,
  children,
}: {
  shellHooks: ShellHooks<T>;
  shellAlerts: ShellAlerts<K>;
  children: ReactNode;
}) => {
  useMemo(() => {
    if (shellHooks) {
      shellHooksStore.setShellHooks(shellHooks);
    }
    if (shellAlerts) {
      shellAlertsStore.setShellAlerts(shellAlerts);
    }
  }, [shellHooks, shellAlerts]);
  return <>{children}</>;
};
