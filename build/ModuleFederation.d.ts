import React, { FunctionComponent, ReactNode } from "react";
type Module = any;
export declare function registerAndLoadModule(scope: string, module: string, url: string): () => Promise<Module>;
export declare function loadModule(scope: string, module: string): () => Promise<Module>;
export declare const useCurrentApp: () => SolutionUI;
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
export declare function FederatedComponent({ url, scope, module, app, renderOnLoading, props, }: FederatedComponentProps & {
    props: any;
    app: SolutionUI;
    renderOnLoading?: ReactNode;
}): React.JSX.Element;
export declare const lazyWithModules: <Props extends {}>(functionComponent: FunctionComponent<React.PropsWithChildren<Props>>, ...modules: {
    module: string;
    url: string;
    scope: string;
}[]) => React.LazyExoticComponent<(originalProps: Props) => React.ReactNode>;
export declare const ComponentWithFederatedImports: <Props extends {}>({ renderOnError, renderOnLoading, componentWithInjectedImports, componentProps, federatedImports, }: {
    renderOnError?: ReactNode;
    renderOnLoading?: ReactNode;
    componentWithInjectedImports: FunctionComponent<React.PropsWithChildren<Props> & {
        moduleExports: Record<string, unknown>;
    }>;
    componentProps: Props;
    federatedImports: {
        remoteEntryUrl: string;
        scope: string;
        module: string;
    }[];
}) => React.JSX.Element;
export {};
