import { world, system, ItemStack, Player } from '@minecraft/server';

// About the project

// QIDB - QUICK ITEM DATABASE
// GitHub:          https://github.com/Carchi777/QUICK-ITEM-DATABASE
// Discord:         https://discord.com/channels/523663022053392405/1252014916496527380

// Made by Carchi77
// My Github:       https://github.com/Carchi777
// My Discord:      https://discordapp.com/users/985593016867778590

export class QIDB {
    /**
     * @param {string} namespace The unique namespace for the database keys.
     * @param {boolean} logs If set to true, the database will log script latency in ms.
     * @param {number} cacheSize Quick the max amount of keys to keep quickly accessible. A small size can couse lag on frequent iterated usage, a large number can cause high hardware RAM usage.
     */
    constructor(namespace = "", cacheSize = 100, logs = false) {
        this.#settings = {
            logs: logs || false,
            namespace: namespace
        };
        this.#queuedKeys = []
        this.#queuedValues = []
        this.#quickAccess = new Map()
        this.#validNamespace = /^[A-Za-z0-9_]*$/.test(this.#settings.namespace)
        this.#dimension = world.getDimension("overworld");

        let sl = world.scoreboard.getObjective('qidb')
        this.#sL;
        const player = world.getPlayers()[0]
        if (!this.#validNamespace) throw new Error(`§c[Item Database] ${namespace} isn't a valid namespace. accepted char: A-Z a-z 0-9 _`);
        if (player)
            if (!sl || sl?.hasParticipant('x') === false) {
                if (!sl) sl = world.scoreboard.addObjective('qidb');
                sl.setScore('x', player.location.x)
                sl.setScore('z', player.location.z)
                this.#sL = { x: sl.getScore('x'), y: 318, z: sl.getScore('z') }
                this.#dimension.runCommand(`/tickingarea add ${this.#sL.x} 319 ${this.#sL.z} ${this.#sL.x} 318 ${this.#sL.z} storagearea`);
                console.log(`§q[Item Database] is initialized successfully. namespace: ${this.#settings.namespace}`)
            } else {
                this.#sL = { x: sl.getScore('x'), y: 318, z: sl.getScore('z') }
                console.log(`§q[Item Database] is initialized successfully. namespace: ${this.#settings.namespace}`)
            }
        world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
            if (!this.#validNamespace) throw new Error(`§c[Item Database] ${namespace} isn't a valid namespace. accepted char: A-Z a-z 0-9 _`);
            if (!initialSpawn) return;
            if (!sl || sl?.hasParticipant('x') === false) {
                if (!sl) sl = world.scoreboard.addObjective('qidb');
                sl.setScore('x', player.location.x)
                sl.setScore('z', player.location.z)
                this.#sL = { x: sl.getScore('x'), y: 318, z: sl.getScore('z') }
                this.#dimension.runCommand(`/tickingarea add ${this.#sL.x} 319 ${this.#sL.z} ${this.#sL.x} 318 ${this.#sL.z} storagearea`);
                console.log(`§q[Item Database] is initialized successfully. namespace: ${this.#settings.namespace}`)
            } else {
                try { sl.getScore('x') } catch { console.log(`§c[Item Database] Initialization Error. namespace: ${this.#settings.namespace}`) }
                this.#sL = { x: sl.getScore('x'), y: 318, z: sl.getScore('z') }
                console.log(`§q[Item Database] is initialized successfully. namespace: ${this.#settings.namespace}`)
            }
        })
        let show = true
        let runId
        const self = this
        let lastam
        let job
        system.runInterval(() => {
            const diff = self.#quickAccess.size - cacheSize;
            if (diff > 0) {
                for (let i = 0; i < diff; i++) {
                    self.#quickAccess.delete(self.#quickAccess.keys().next()?.value);
                }
            }
            if (self.#queuedKeys.length && !job) {
                runJobSave()
                console.log('run')
            }
        }, 20)
        function runJobSave() {
            job = system.runJob((function* () {
                while (true) {

                    if (self.#queuedKeys.length) {

                        if (!runId) {
                            function log() {
                                const abc = (-(self.#queuedKeys.length - lastam) / 6).toFixed(0) || '//'
                                console.log(`§eSaving, Dont close the world.\n§r[Stats]-§eRemaining: ${self.#queuedKeys.length} keys | speed: ${abc} keys/s`)
                                lastam = self.#queuedKeys.length
                            }
                            log()
                            runId = system.runInterval(() => {
                                log()
                            }, 120)
                        }
                        show = false
                        const start = Date.now()
                        if (self.#queuedKeys.length) {
                            self.#romSave(self.#queuedKeys[0], self.#queuedValues[0]); if (logs) self.#timeWarn(start, self.#queuedKeys[0], "saved"); self.#queuedKeys.shift(); self.#queuedValues.shift()
                        }
                        yield;
                    } else if (runId) {
                        system.clearRun(runId)
                        system.clearJob(job)
                        runId = undefined
                        show == false && console.log("§aSaved, You can now close the world safely.")
                        show = true
                        return
                    } else return
                }
            })())
        }
        world.beforeEvents.playerLeave.subscribe(() => {
            if (this.#queuedKeys.length && world.getPlayers().length < 2) {
                console.error(
                    `\n\n\n\n§c[Item Database]-[Fatal Error] World closed too early, items not saved correctly. \n\n` +
                    `Namespace: ${this.#settings.namespace}\n` +
                    `Lost Keys amount: ${this.#queuedKeys.length}\n\n\n\n`
                )
            }
        })
    }
    #validNamespace;
    #queuedKeys;
    #settings;
    #quickAccess;
    #queuedValues;
    #dimension;
    #sL;
    QAMusage() {
        return this.#quickAccess.size;
    }
    #load(key) {
        if (key.length > 30) throw new Error(`§c[Item Database] Out of range: <${key}> has more than 30 characters`)
        let canStr = false;
        try {
            world.structureManager.place(key, this.#dimension, this.#sL, { includeEntities: true });
            canStr = true;
        } catch {
            this.#dimension.spawnEntity("qidb:storage", this.#sL);
        }
        const entities = this.#dimension.getEntities({ location: this.#sL, type: "qidb:storage" });
        if (entities.length > 1) entities.forEach((e, index) => entities[index + 1]?.remove());
        const entity = entities[0];
        const inv = entity.getComponent("inventory").container;
        return { canStr, inv };
    }
    async #save(key, canStr) {
        if (canStr) world.structureManager.delete(key);
        world.structureManager.createFromWorld(key, this.#dimension, this.#sL, this.#sL, { saveMode: "World", includeEntities: true });
        const entities = this.#dimension.getEntities({ location: this.#sL, type: "qidb:storage" });
        entities.forEach(e => e.remove());
    }
    #timeWarn(time, key, action) {
        console.warn(`[Item Database] ${Date.now() - time}ms => ${action} ${key} `);
    }
    async #queueSaving(key, value) {
        this.#queuedKeys.push(key)
        this.#queuedValues.push(value)
    }
    async #romSave(key, value) {
        const { canStr, inv } = this.#load(key);
        if (!value) for (let i = 0; i < 256; i++) inv.setItem(i, undefined), world.setDynamicProperty(key, null);
        if (Array.isArray(value)) {
            try { for (let i = 0; i < 256; i++) inv.setItem(i, value[i] || undefined) } catch { throw new Error(`§c[Item Database] Invalid value type. supported: ItemStack | ItemStack[] | undefined`) }
            world.setDynamicProperty(key, true)
        } else {
            try { inv.setItem(0, value), world.setDynamicProperty(key, false) } catch { throw new Error(`§c[Item Database] Invalid value type. supported: ItemStack | ItemStack[] | undefined`) }
        }
        this.#save(key, canStr);
    }

    /**
     * Sets a value as a key in the item database.
     * @param {string} key The unique identifier of the value.
     * @param {ItemStack[] | ItemStack} value The `ItemStack[]` or `itemStack` value to set.
     * @throws Throws if `value` is an array that has more than 255 items.
     */
    set(key, value) {
        if (!this.#validNamespace) throw new Error(`§c[Item Database] Invalid name: <${this.#settings.namespace}>. accepted char: A-Z a-z 0-9 _`);
        if (!/^[A-Za-z0-9_]*$/.test(key)) throw new Error(`§c[Item Database] Invalid name: <${key}>. accepted char: A-Z a-z 0-9 _`);
        const time = Date.now();
        key = this.#settings.namespace + ":" + key;
        if (Array.isArray(value)) {
            if (value.length > 255) throw new Error(`§c[Item Database] Out of range: <${key}> has more than 255 ItemStacks`)
            world.setDynamicProperty(key, true)
        } else {
            world.setDynamicProperty(key, false)
        }
        this.#quickAccess.set(key, value)
        if (this.#queuedKeys.includes(key)) {
            const i = this.#queuedKeys.indexOf(key)
            this.#queuedValues.splice(i, 1)
            this.#queuedKeys.splice(i, 1)
        }
        this.#queueSaving(key, value)
        if (this.#settings.logs) this.#timeWarn(time, key, "set");
    }
    /**
     * Gets the value of a key from the item database.
     * @param {string} key The identifier of the value.
     * @returns {ItemStack | ItemStack[]} The `ItemStack` | `ItemStack[]` saved as `key`
     * @throws Throws if the key doesn't exist.
     */
    get(key) {
        if (!this.#validNamespace) throw new Error(`§c[Item Database] Invalid name: <${this.#settings.namespace}>. accepted char: A-Z a-z 0-9 _`);
        if (!/^[A-Za-z0-9_]*$/.test(key)) throw new Error(`§c[Item Database] Invalid name: <${key}>. accepted char: A-Z a-z 0-9 _`);
        const time = Date.now();
        key = this.#settings.namespace + ":" + key;
        if (this.#quickAccess.has(key)) { if (this.#settings.logs) this.#timeWarn(time, key, "got"); return this.#quickAccess.get(key); }
        const structure = world.structureManager.get(key)
        if (!structure) throw new Error(`§c[Item Database] The key <${key}> doesn't exist.`);
        const { canStr, inv } = this.#load(key);
        const items = [];
        for (let i = 0; i < 256; i++) items.push(inv.getItem(i));
        for (let i = 255; i >= 0; i--) if (!items[i]) items.pop(); else break;
        this.#save(key, canStr);
        if (this.#settings.logs) this.#timeWarn(time, key, "got");
        if (world.getDynamicProperty(key)) { this.#quickAccess.set(key, items); return items }
        else { this.#quickAccess.set(key, items[0]); return items[0]; }
    }
    /**
     * Checks if a key exists in the item database.
     * @param {string} key The identifier of the value.
     * @returns {boolean}`true` if the key exists, `false` if the key doesn't exist.
     */
    has(key) {
        if (!this.#validNamespace) throw new Error(`§c[Item Database] Invalid name: <${this.#settings.namespace}>. accepted char: A-Z a-z 0-9 _`);
        if (!/^[A-Za-z0-9_]*$/.test(key)) throw new Error(`§c[Item Database] Invalid name: <${key}>. accepted char: A-Z a-z 0-9 _`);
        const time = Date.now();
        key = this.#settings.namespace + ":" + key;
        const exist = this.#quickAccess.has(key) || world.structureManager.get(key)
        if (this.#settings.logs) this.#timeWarn(time, key, `has ${!!exist}`);
        if (exist) return true; else return false
    }
    /**
     * Deletes a key from the item database.
     * @param {string} key The identifier of the value.
     * @throws Throws if the key doesn't exist.
     */
    delete(key) {
        if (!this.#validNamespace) throw new Error(`§c[Item Database] Invalid name: <${this.#settings.namespace}>. accepted char: A-Z a-z 0-9 _`);
        if (!/^[A-Za-z0-9_]*$/.test(key)) throw new Error(`§c[Item Database] Invalid name: <${key}>. accepted char: A-Z a-z 0-9 _`);
        const time = Date.now();
        key = this.#settings.namespace + ":" + key;
        if (this.#quickAccess.has(key)) this.#quickAccess.delete(key)
        const structure = world.structureManager.get(key)
        if (structure) world.structureManager.delete(key), world.setDynamicProperty(key, null);
        else throw new Error(`§c[Item Database] The key <${key}> doesn't exist.`);
        if (this.#settings.logs) this.#timeWarn(time, key, "removed");
    }
    /**
     * Gets all the keys of your namespace from item database.
     * @return {string[]} All the keys as an array of strings.
     */
    keys() {
        if (!this.#validNamespace) throw new Error(`§c[Item Database] Invalid name: <${this.#settings.namespace}>. accepted char: A-Z a-z 0-9 _`);
        const allIds = world.getDynamicPropertyIds()
        const ids = []
        allIds.filter(id => id.startsWith(this.#settings.namespace + ":")).forEach(id => ids.push(id.replace(this.#settings.namespace + ":", "")))
        return ids;
    }
    /**
     * Gets all the keys of your namespace from item database (takes some time if values aren't alredy loaded in quickAccess).
     * @return {ItemStack[][]} All the values as an array of ItemStack or ItemStack[].
     */
    values() {
        if (!this.#validNamespace) throw new Error(`§c[Item Database] Invalid name: <${this.#settings.namespace}>. accepted char: A-Z a-z 0-9 _`);
        const time = Date.now();
        const allIds = world.getDynamicPropertyIds()
        const values = []
        const filtered = allIds.filter(id => id.startsWith(this.#settings.namespace + ":")).map(id => id.replace(this.#settings.namespace + ":", ""))
        for (const key of filtered) {
            values.push(this.get(key));
        }
        if (this.#settings.logs) this.#timeWarn(time, `${JSON.stringify(values)}`, "values");
        return values;
    }
    /**
     * Clears all, CAN NOT REWIND.
     */
    clear() {
        if (!this.#validNamespace) throw new Error(`§c[Item Database] Invalid name: <${this.#settings.namespace}>. accepted char: A-Z a-z 0-9 _`);
        const time = Date.now();
        const allIds = world.getDynamicPropertyIds()
        const filtered = allIds.filter(id => id.startsWith(this.#settings.namespace + ":")).map(id => id.replace(this.#settings.namespace + ":", ""))
        for (const key of filtered) {
            this.delete(key)
        }
        if (this.#settings.logs) this.#timeWarn(time, ``, "clear");
    }
}
