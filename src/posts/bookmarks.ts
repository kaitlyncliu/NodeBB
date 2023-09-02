// Ignoring the import-export since the rest of the codebase uses imports and exports and changing would
// break other code
/* eslint-disable import/no-import-module-exports */

// The next line calls a function in a module that has not been updated to TS yet
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
import db from '../database';
import plugins from '../plugins';

interface PostHandlerType {
    bookmark: (pid: number, uid: string) => Promise<ToggleBookmarkResult>;
    unbookmark: (pid: number, uid: string) => Promise<ToggleBookmarkResult>;
    getPostFields: (pid: number, field: string[]) => Promise<PostData>;
    hasBookmarked: (pid: NumberOrNumberArr, uid: string) => Promise<BoolOrBoolArr>;
    setPostField: (pid: number, field: string, data: NumberOrNumberArr) => Promise<void>;
}

interface PostData {
    pid: number;
    uid: number;
    bookmarks?: NumberOrNumberArr;
}

interface ToggleBookmarkResult {
    post: PostData;
    isBookmarked: boolean;
}

type BoolOrBoolArr = boolean | boolean[]
type NumberOrNumberArr = number | number[]

module.exports = function (Posts: PostHandlerType) {
    async function toggleBookmark(type: string, pid: number, uid: string):Promise<ToggleBookmarkResult> {
        if (parseInt(uid, 10) <= 0) {
            throw new Error('[[error:not-logged-in]]');
        }

        const isBookmarking = type === 'bookmark';

        const [postData, hasBookmarked] = await Promise.all([
            Posts.getPostFields(pid, ['pid', 'uid']),
            Posts.hasBookmarked(pid, uid),
        ]);

        if (isBookmarking && hasBookmarked) {
            throw new Error('[[error:already-bookmarked]]');
        }

        if (!isBookmarking && !hasBookmarked) {
            throw new Error('[[error:already-unbookmarked]]');
        }

        if (isBookmarking) {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            await db.sortedSetAdd(`uid:${uid}:bookmarks`, Date.now(), pid);
        } else {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            await db.sortedSetRemove(`uid:${uid}:bookmarks`, pid);
        }
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db[isBookmarking ? 'setAdd' : 'setRemove'](`pid:${pid}:users_bookmarked`, uid);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        postData.bookmarks = await db.setCount(`pid:${pid}:users_bookmarked`); // eslint-disable-line @typescript-eslint/no-unsafe-assignment
        await Posts.setPostField(pid, 'bookmarks', postData.bookmarks);

        await plugins.hooks.fire(`action:post.${type}`, {
            pid: pid,
            uid: uid,
            owner: postData.uid,
            current: hasBookmarked ? 'bookmarked' : 'unbookmarked',
        });

        return {
            post: postData,
            isBookmarked: isBookmarking,
        };
    }

    Posts.bookmark = async function (pid: number, uid: string) {
        return await toggleBookmark('bookmark', pid, uid);
    };

    Posts.unbookmark = async function (pid: number, uid: string) {
        return await toggleBookmark('unbookmark', pid, uid);
    };

    Posts.hasBookmarked = async function (pid, uid): Promise<BoolOrBoolArr> {
        if (parseInt(uid, 10) <= 0) {
            return Array.isArray(pid) ? pid.map(() => false) : false;
        }

        if (Array.isArray(pid)) {
            const sets = pid.map(pid => `pid:${pid}:users_bookmarked`);
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            return await db.isMemberOfSets(sets, uid); // eslint-disable-line @typescript-eslint/no-unsafe-return
        }
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        return await db.isSetMember(`pid:${pid}:users_bookmarked`, uid); // eslint-disable-line @typescript-eslint/no-unsafe-return
    };
};
