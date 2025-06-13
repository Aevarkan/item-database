// About the project

// QIDB - QUICK ITEM DATABASE
// GitHub:          https://github.com/Carchi777/QUICK-ITEM-DATABASE
// Discord:         https://discord.com/channels/523663022053392405/1252014916496527380

// Made by Carchi77
// My Github:       https://github.com/Carchi777
// My Discord:      https://discordapp.com/users/985593016867778590

/**
 * TypeScript implementation by Aevarkan (https://github.com/Aevarkan)
 * Changes:
 * Typescript private keyword is used instead of hash notation
 * Only one error is thrown for an invalid namespace. This is thrown during the constructor.
 * The database only returns ItemStack arrays instead of single ItemStack instances
 * Namespace is mandatory, you cannnot put an empty namespace (that's seriously bad practice!)
 * 
 * Targeted SAPI version: 2.1.0-beta (2.1.0-rc.1.21.100-preview.20)
 * There may or may not be TypeScript compiler errors depending on your target version.
 * These errors shouldn't affect functionality, however.
 */

import { world, system, ItemStack, Entity, Dimension, StructureSaveMode, EntityComponentTypes, Vector3, Container, EntityInventoryComponent } from '@minecraft/server';

function date() {
    const date = new Date(Date.now())
    const ms = date.getMilliseconds().toString().padStart(3, "0")
    return `${date.toLocaleString().replace(' AM', `.${ms} AM`).replace(' PM', `.${ms} PM`)}`
}

/**
 * Logs an action to console, adding a prefix.
 * @param message The message to log.
 * @param logType The priority of the log.
 * @param showStackTrace Whether to show the stack trace after the error.
 */
function logAction(message: any, logType: LogTypes, showStackTrace = false) {
    let prefixedMessage = "QIDB > " + message

    switch (logType) {
        case LogTypes.warn:
            prefixedMessage = "§6" + prefixedMessage
            console.warn(prefixedMessage)
            break

        case LogTypes.error:
            prefixedMessage = "§c" + prefixedMessage
            console.error(prefixedMessage)
            break

        case LogTypes.log:
        default:
            prefixedMessage = "§a" + prefixedMessage
            console.log(prefixedMessage)
            break
    }

    if (showStackTrace) console.trace()
}

enum LogTypes {
    log,
    warn,
    error
}

export interface ItemDatabaseSettings {
    namespace: string
}

export interface ItemDatabaseLogSettings {
    startUp: boolean,
    save: boolean,
    load: boolean,
    set: boolean,
    get: boolean,
    has: boolean,
    delete: boolean,
    clear: boolean,
    values: boolean,
    keys: boolean,
}

const defaultLogs: ItemDatabaseLogSettings = {
    startUp: true,
    save: true,
    load: false,
    set: false,
    get: false,
    has: false,
    delete: false,
    clear: true,
    values: false,
    keys: false,
}

export class QIDB {
    /**
     * The scoreboard objective id used when initialising.
     */
    private static readonly SCOREBOARD_ID: string = "qidb"
    /**
     * The entity used for storing items.
     */
    private static readonly STORAGE_ENTITY: string = "qidb:storage"
    /**
     * The namespace for QIDB only allows lower and uppercase English characters, numbers 0 to 9, and the underscore _.
     */
    private static readonly VALID_NAMESPACE: RegExp = /^[A-Za-z0-9_]+$/
    /**
     * `ItemStack[]`s that are currently stored in memory instead of in a structure.
     */
    private quickAccess: Map<string, ItemStack[]>
    /**
     * Keys that are currently in the save queue.
     */
    private queuedKeys: string[]
    /**
     * `ItemStack[]`s that are currently waiting to be saved.
     */
    private queuedValues: ItemStack[][]
    /**
     * Where the storage entity will be spawned.
     */
    private spawnLocation: Vector3
    /**
     * Contains the database settings.
     */
    private readonly settings: ItemDatabaseSettings
    /**
     * Objecet that describes the actions that should be logged to console.
     */
    private readonly logs: ItemDatabaseLogSettings
    /**
     * The dimension that the storage entities will be spawned in.
     */
    private dimension: Dimension

    /**
     * Creates a new QIDB instance.
     * 
     * @param namespace
     * The unique namespace for the database keys. This will be the prefix used before the colon `:` in the structure's name.
     * 
     * Supports lower and uppercase English characters, numbers 0 to 9, and the underscore `_`.
     * 
     * @param cacheSize
     * The max amount of keys to keep quickly accessible. A small size can cause lag on frequent iterated usage, a large number can cause high hardware RAM usage.
     * 
     * The default size is 50 elements.
     * 
     * @param saveRate
     * The background saves per tick (high performance impact).
     * 
     * The default `saveRate` of 1 is 20 keys per second.
     * 
     * @param logSettings The database actions that should be logged to console.
     * 
     * @throws Throws if an invalid namespace is provided.
     * 
     * @remarks This should be initialised in the global namespace; not doing so can lead to errors.
     */
    constructor(namespace: string, cacheSize: number = 50, saveRate: number = 1, logSettings: ItemDatabaseLogSettings = defaultLogs) {
        this.settings = { namespace: namespace }
        this.queuedKeys = []
        this.queuedValues = []
        this.quickAccess = new Map()
        // We need to assign the dimension later due to early execution
        // this.dimension = world.getDimension("minecraft:overworld")


        // Check the namespace, if its bad, then we stop immediately
        if (!(QIDB.VALID_NAMESPACE.test(this.settings.namespace))) {
            logAction(`${namespace} isn't a valid namespace. accepted char: A-Z a-z 0-9 _ §r${date()}`, LogTypes.error)
            throw new Error(`Invalid namespace: ${namespace}`)
        }

        // Apply the log settings
        this.logs = logSettings

        // Arrow function to preserve `this`
        const startLog = () => {
            logAction(`Initialized successfully.§r namespace: ${this.settings.namespace} §r${date()}`, LogTypes.log)

            if (saveRate > 1) {
                logAction(`using a saveRate bigger than 1 can cause slower game ticks and extreme lag while saving 1024 size keys. at <${this.settings.namespace}> §r${date()}`, LogTypes.warn)
                // player.isOp doesn't appear to be a thing
                // world.getPlayers().forEach(player => {
                //     if (player.isOp) {
                //         player.sendMessage(
                //             `§c§lWARNING! \n§r§cQIDB > using a saveRate bigger than 1 can cause slower game ticks and extreme lag while saving 1024 size keys. at <${this.settings.namespace}> §r${date()} `
                //         )
                //     }
                // })
            }

        }

        // 2.0 requires this due to early execution
        system.run(() => {
            this.dimension = world.getDimension("minecraft:overworld")

            let sl = world.scoreboard.getObjective(QIDB.SCOREBOARD_ID)
            const player = world.getPlayers()[0]
            if (player) {
                if (!sl || sl?.hasParticipant('x') === false) {
                    if (!sl) sl = world.scoreboard.addObjective(QIDB.SCOREBOARD_ID);
                    sl.setScore('x', player.location.x)
                    sl.setScore('z', player.location.z)
                    this.spawnLocation = { x: sl.getScore('x') as number, y: 318, z: sl.getScore('z')  as number }
                    this.dimension.runCommand(`/tickingarea add ${this.spawnLocation.x} 319 ${this.spawnLocation.z} ${this.spawnLocation.x} 318 ${this.spawnLocation.z} storagearea`);
                    startLog()
                } else {
                    this.spawnLocation = { x: sl.getScore('x')  as number, y: 318, z: sl.getScore('z') as number}
                    startLog()
                }
            }
            world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
                if (!initialSpawn) return;
                if (!sl || sl?.hasParticipant('x') === false) {
                    if (!sl) sl = world.scoreboard.addObjective(QIDB.SCOREBOARD_ID);
                    sl.setScore('x', player.location.x)
                    sl.setScore('z', player.location.z)
                    this.spawnLocation = { x: sl.getScore('x') as number, y: 318, z: sl.getScore('z') as number }
                    this.dimension.runCommand(`/tickingarea add ${this.spawnLocation.x} 319 ${this.spawnLocation.z} ${this.spawnLocation.x} 318 ${this.spawnLocation.z} storagearea`);
                    startLog()
                } else {
                    this.spawnLocation = { x: sl.getScore('x') as number, y: 318, z: sl.getScore('z') as number }
                    startLog()
                }
            })
            let show = true
            let runId
            let lastam
            system.runInterval(() => {
                const diff = this.quickAccess.size - cacheSize;
                if (diff > 0) {
                    for (let i = 0; i < diff; i++) {
                        this.quickAccess.delete(this.quickAccess.keys().next()?.value);
                    }
                }
                if (this.queuedKeys.length) {

                    if (!runId) {

                        log()
                        runId = system.runInterval(() => {
                            log()
                        }, 120)
                    }
                    show = false
                    const k = Math.min(saveRate, this.queuedKeys.length)
                    for (let i = 0; i < k; i++) {
                        this.save(this.queuedKeys[0], this.queuedValues[0]);
                        this.queuedKeys.shift();
                        this.queuedValues.shift()
                    }
                } else if (runId) {
                    system.clearRun(runId)
                    runId = undefined
                    show == false && this.logs.save == true && logAction(`Saved, You can now close the world safely. §r${date()}`, LogTypes.log)
                    show = true
                    return
                } else return
            }, 1)
            // Arrow function to preserve `this`
            const log = () => {
                const abc = (-(this.queuedKeys.length - lastam) / 6).toFixed(0) || '//'
                this.logs.save == true && logAction(`Saving, Dont close the world.\n§r[Stats]-§eRemaining: ${this.queuedKeys.length} keys | speed: ${abc} keys/s §r${date()}`, LogTypes.log)
                lastam = this.queuedKeys.length
            }
            system.beforeEvents.shutdown.subscribe(() => {
                if (this.queuedKeys.length) {
                    logAction(
                        `Fatal Error >§r§c World closed too early, items not saved correctly.  \n\n` +
                        `Namespace: ${this.settings.namespace}\n` +
                        `Lost Keys amount: ${this.queuedKeys.length} §r${date()}\n\n\n\n`,
                        LogTypes.error
                    )
                }
            })
        })
        
    }

    /**
     * Gets the inventories of the storage entities.
     * @param key The structure name, including the prefix.
     * @param requiredEntities
     * The number of entities required to contain all inventories. Each entity can store a maximum of 256 slots.
     * 
     * Not required when loading inventories.
     * 
     * @returns The {@link Container}s of the storage entities, and whether or not there was an existing structure.
     * @remarks
     * This spawns in empty entities if the value for the key doesn't exist.
     * 
     * This function can't be called in read-only mode.
     */
    private getInventories(key: string, requiredEntities?: number) {
        // Check the key length, we don't accept longer than 30 characters
        if (key.length > 30) {
            logAction(`Out of range: <${key}> has more than 30 characters §r${date()}`, LogTypes.error)
            throw new Error(`§cQIDB > Out of range: <${key}> has more than 30 characters §r${date()}`)
        }

        // Get the existing structure if it's there, otherwise spawn in new storage entities
        let existingStructure = false
        const structure = world.structureManager.get(key)
        if (structure) {
            world.structureManager.place(structure, this.dimension, this.spawnLocation, { includeEntities: true })
            existingStructure = true
        } else {
            logAction(requiredEntities, LogTypes.log)
            if (requiredEntities) {
                for (let i = 0; i < requiredEntities; i++) {
                    // If there is an error here, just get rid of <typeof QIDB.STORAGE_ENTITY>. It's simply there to stop TypeScript errors.
                    this.dimension.spawnEntity<typeof QIDB.STORAGE_ENTITY>(QIDB.STORAGE_ENTITY, this.spawnLocation)
                }
            }
        }

        // Now get those storage entities
        const entities: Entity[] = this.dimension.getEntities({ location: this.spawnLocation, type: QIDB.STORAGE_ENTITY })
        if (requiredEntities) {
            // Spawn more storage entities if needed
            if (entities.length < requiredEntities) {
                for (let i = entities.length; i < requiredEntities; i++) {
                    // If there is an error here, just get rid of <typeof QIDB.STORAGE_ENTITY>. It's simply there to stop TypeScript errors.
                    entities.push(this.dimension.spawnEntity<typeof QIDB.STORAGE_ENTITY>(QIDB.STORAGE_ENTITY, this.spawnLocation))
                }
            }
            // Vice versa if there are more entities than needed
            if (entities.length > requiredEntities) {
                logAction(`entities.length > length: ${entities.length} > ${requiredEntities} ${entities.length > requiredEntities}`, LogTypes.log)
                for (let i = entities.length; i > requiredEntities; i--) {
                    logAction(`removed ${i}`, LogTypes.log)
                    entities[i - 1].remove()
                    entities.pop()
                }
            }
        }

        // Now get their inventories
        const containers: Container[] = []
        entities.forEach(entity => {
            containers.push((entity.getComponent(EntityComponentTypes.Inventory) as EntityInventoryComponent).container)
        })

        this.logs.load == true && logAction(`Loaded ${entities.length} entities <${key}> §r${date()}`, LogTypes.log)
        return { existingStructure, containers }
    }

    /**
     * Saves a structure to the world
     * @param key The identifier of the structure.
     * @param existingStructure Whether or not the structure already exists. This must be determined from elsewhere.
     */
    private async saveStructure(key: string, existingStructure: boolean) {
        // Delete the structure if it exists
        if (existingStructure) world.structureManager.delete(key)

        // Now create the new structure
        world.structureManager.createFromWorld(key, this.dimension, this.spawnLocation, this.spawnLocation, { saveMode: StructureSaveMode.World, includeEntities: true });
        
        // Delete the storage entities
        const entities = this.dimension.getEntities({ location: this.spawnLocation, type: QIDB.STORAGE_ENTITY });
        entities.forEach(e => e.remove());
    }

    /**
     * Queues a key-itemstack pair for saving.
     * @param key The identifier for the pair, this will be the name of the structure.
     * @param value The itemstacks to save.
     */
    private async queueSave(key: string, value: ItemStack[]) {
        this.queuedKeys.push(key)
        this.queuedValues.push(value)
    }

    /**
     * Saves itemstacks into a structure.
     * @param key The structure identifier.
     * @param value The itemstacks to save.
     * @remarks Clears the inventory of the storage entity if `value` is undefined.
     */
    private async save(key: string, value: undefined | ItemStack | ItemStack[]) {
        // Get the number of storage entities we'll need to store the items
        let requiredEntities = 1
        const isArray = Array.isArray(value)
        if (isArray) {
            requiredEntities = Math.floor((value?.length - 1) / 256) + 1
        }

        // Get the inventories to place the items in
        const { existingStructure, containers } = this.getInventories(key, requiredEntities)

        // Place the items
        containers.forEach((inv, index) => {
            // If undefined, then clear inventories
            if (!value) for (let i = 256 * index; i < 256 * index + 256; i++) inv.setItem(i - 256 * index, undefined), world.setDynamicProperty(key, undefined);
            // Otherwise save them
            if (isArray) {
                try { for (let i = 256 * index; i < 256 * index + 256; i++) inv.setItem(i - 256 * index, value[i] || undefined) } catch { throw new Error(`§cQIDB > Invalid value type. supported: ItemStack | ItemStack[] | undefined §r${date()}`) }
                world.setDynamicProperty(key, (Math.floor((value?.length - 1) / 256) + 1) || 1)
            } else {
                try { inv.setItem(0, value), world.setDynamicProperty(key, false) } catch { throw new Error(`§cQIDB > Invalid value type. supported: ItemStack | ItemStack[] | undefined §r${date()}`) }
            }
        })

        // Now save it onto disk
        await this.saveStructure(key, existingStructure);
    }

    /**
     * Sets a value as a key in the item database.
     * @param key The unique identifier of the value.
     * @param value The `ItemStack[]` or `ItemStack` value to set.
     * @throws Throws if `value` is an `ItemStack` array that has more than 1024 items.
     * @remarks
     * This function **can** be called in read-only mode, but the item is saved later in the tick. 
     * 
     * The maximum array size is 1024 elements.
     */
    public set(key: string, value: ItemStack[] | ItemStack): void {
        const time = Date.now();
        const fullKey = this.settings.namespace + ":" + key

        // Put the ItemStack into an array if its not already
        let itemStackArray = value
        if (!(Array.isArray(itemStackArray))) {
            itemStackArray = [itemStackArray]
        }

        // Throw an error if trying to save more than 1024 ItemStacks
        if (itemStackArray.length > 1024) {
            logAction(`Out of range: <${fullKey}> has more than 1024 ItemStacks §r${date()}`, LogTypes.error)
            throw new Error(`§cQIDB > Out of range: <${fullKey}> has more than 1024 ItemStacks §r${date()}`)
        }

        world.setDynamicProperty(fullKey, (Math.floor((itemStackArray.length - 1) / 256) + 1) || 1)

        // Add to memory cache
        this.quickAccess.set(fullKey, itemStackArray)
        // Remove any in the queue and add the new one at the top
        if (this.queuedKeys.includes(fullKey)) {
            const i = this.queuedKeys.indexOf(fullKey)
            this.queuedValues.splice(i, 1)
            this.queuedKeys.splice(i, 1)
        }
        this.queueSave(fullKey, itemStackArray)

        this.logs.set == true && logAction(`Set key <${fullKey}> succesfully. ${Date.now() - time}ms §r${date()}`, LogTypes.log)

    }

    /**
     * Gets the value of a key from the item database.
     * @param key The identifier of the value.
     * @returns The `ItemStack[]` saved as `key`.
     * @throws Throws if the key doesn't exist.
     * @remarks
     * This function can't be called in read-only mode.
     * 
     * Single `ItemStack`s saved using `set` will still return an array.
     */
    public get(key: string): ItemStack[] {
        const time = Date.now();
        const fullKey = this.settings.namespace + ":" + key

        // Try quick access cache first
        if (this.quickAccess.has(fullKey)) {
            this.logs.get == true && logAction(`Got key <${fullKey}> succesfully. ${Date.now() - time}ms §r${date()}`, LogTypes.log)
            return this.quickAccess.get(fullKey) as ItemStack[]
        }

        // Now we'll have to get the structure saved on disk
        const structure = world.structureManager.get(fullKey)
        if (!structure) {
            logAction(`The key < ${fullKey} > doesn't exist.`, LogTypes.error)
            throw new Error(`§cQIDB > The key < ${fullKey} > doesn't exist.`)
        }
        // Get the containers
        const { existingStructure, containers } = this.getInventories(fullKey)
        const items: ItemStack[] = []
        containers.forEach((inv, index) => {
            for (let i = 256 * index; i < 256 * index + 256; i++) items.push(inv.getItem(i - 256 * index) as ItemStack);
            for (let i = 256 * index + 255; i >= 0; i--) if (!items[i]) items.pop(); else break;
        })
        this.saveStructure(key, existingStructure);

        this.logs.get == true && logAction(`Got items from <${key}> succesfully. ${Date.now() - time}ms §r${date()}`, LogTypes.log)

        // Save the item we just got to cache
        this.quickAccess.set(key, items)
        return items
    }

    /**
     * Checks if a key exists in the item database.
     * @param key The identifier of the value.
     * @returns `true` if the key exists, `false` if the key doesn't exist.
     * @remarks This function can't be called in read-only mode.
     */
    public has(key: string): boolean {
        const time = Date.now();
        key = this.settings.namespace + ":" + key;
        const exist = this.quickAccess.has(key) || world.structureManager.get(key)
        this.logs.has == true && logAction(`Found key <${key}> succesfully. ${Date.now() - time}ms §r${date()}`, LogTypes.log)


        if (exist) return true; else return false
    }

    /**
     * Deletes a key from the item database.
     * @param key The identifier of the value.
     * @throws Throws if the key doesn't exist.
     * @remarks This function can't be called in read-only mode.
     */
    public delete(key: string): void {
        const time = Date.now();
        key = this.settings.namespace + ":" + key;
        if (this.quickAccess.has(key)) this.quickAccess.delete(key)
        const structure = world.structureManager.get(key)
        if (structure) world.structureManager.delete(key), world.setDynamicProperty(key, undefined);
        else throw new Error(`§cQIDB > The key <${key}> doesn't exist. §r${date()}`);
        this.logs.delete == true && logAction(`Deleted key <${key}> succesfully. ${Date.now() - time}ms §r${date()}`, LogTypes.log)
    }

    /**
     * Gets all the keys of your namespace from item database.
     * @returns All the keys as an array of strings.
     */
    public keys(): string[] {
        const allIds = world.getDynamicPropertyIds()
        const ids: string[] = []
        allIds.filter(id => id.startsWith(this.settings.namespace + ":")).forEach(id => ids.push(id.replace(this.settings.namespace + ":", "")))
        this.logs.keys == true && logAction(`Got the list of all the ${ids.length} keys. §r${date()}`, LogTypes.log)

        return ids
    }

    /**
     * Gets all the keys of your namespace from item database (takes some time if values aren't alredy loaded in quickAccess).
     * @returns All values as an `ItemStack[]` array.
     * @remarks This function can't be called in read-only mode.
     */
    public values(): ItemStack[][] {
        const time = Date.now();
        const allIds = world.getDynamicPropertyIds()
        const values: ItemStack[][] = []
        const filtered = allIds.filter(id => id.startsWith(this.settings.namespace + ":")).map(id => id.replace(this.settings.namespace + ":", ""))
        for (const key of filtered) {
            values.push(this.get(key))
        }
        this.logs.values == true && logAction(`Got the list of all the ${values.length} values. ${Date.now() - time}ms §r${date()}`, LogTypes.log)

        return values
    }

    /**
     * Clears all, CAN NOT REWIND.
     * @remarks
     * This function can't be called in read-only mode.
     * 
     * This clears all structures that are using the namespace that also have a key in the database.
     * This can possibly include your own ones.
     */
    public clear() {
        const time = Date.now();
        const allIds = world.getDynamicPropertyIds()
        const filtered = allIds.filter(id => id.startsWith(this.settings.namespace + ":")).map(id => id.replace(this.settings.namespace + ":", ""))
        for (const key of filtered) {
            this.delete(key)
        }
        this.logs.clear == true && logAction(`Cleared, deleted ${filtered.length} values. ${Date.now() - time}ms §r${date()}`, LogTypes.log)
    }
}