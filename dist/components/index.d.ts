import { QuartzComponent } from '@quartz-community/types';

declare const component: QuartzComponent & {
    displayName: string;
    css: string;
};

export { component as InfinitePopover };
