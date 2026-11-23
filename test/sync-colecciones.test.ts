/* =========================================================
   sync-colecciones.test.ts — El guardian de las colecciones
   sincronizadas.

   sync.ts sabe de cada coleccion en TRES lugares: flatten(),
   que arma los documentos a subir; el mapa ARR, que dice en que
   arreglo del estado va cada tipo al bajarlo; y el comentario
   de cabecera, que documenta los docId.

   Si falta la entrada en ARR, applyRemote hace `if (!spec)
   return` y se va callado: los datos suben a Firestore y nunca
   se aplican en el otro dispositivo. La sincronizacion anda a
   medias y no grita. Este test hace que grite.

   La tecnica es la misma que usa acciones.test.ts con la tabla
   de eventos: leer el fuente y exigir que las dos listas digan
   lo mismo.
   ========================================================= */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const FUENTE = readFileSync(resolve(__dirname, "../src/sync.ts"), "utf8");

/** Los prefijos que flatten() emite, de `m["ex_" + e.id]`. */
const prefijosQueSuben = (): string[] => {
  const cuerpo = FUENTE.slice(FUENTE.indexOf("function flatten("));
  const hasta = cuerpo.slice(0, cuerpo.indexOf("\n  }"));
  return [...hasta.matchAll(/m\["([a-z]+)_"/g)].map((m) => m[1]);
};

/** Las claves del mapa ARR, que es por donde bajan. */
const prefijosQueBajan = (): string[] => {
  const linea = /const ARR:[^=]+=\s*\{([^}]*)\}/.exec(FUENTE);
  if (!linea) throw new Error("No encontre el mapa ARR en sync.ts");
  return [...linea[1].matchAll(/(\w+):\s*\[/g)].map((m) => m[1]);
};

/** Los docId documentados en el comentario de cabecera. */
const prefijosDocumentados = (): string[] => {
  const cabecera = FUENTE.slice(0, FUENTE.indexOf("*/"));
  return [...cabecera.matchAll(/^\s+([a-z]+)_</gm)].map((m) => m[1]);
};

describe("toda coleccion que sube tiene que poder bajar", () => {
  it("cada prefijo que emite flatten() esta en el mapa ARR", () => {
    const bajan = prefijosQueBajan();
    for (const prefijo of prefijosQueSuben()) {
      // Si esto falla: agregaste la coleccion a flatten() y te olvidaste de
      // ARR. Sube a Firestore y applyRemote la descarta en silencio.
      expect(bajan, `falta "${prefijo}" en el mapa ARR de sync.ts`).toContain(prefijo);
    }
  });

  it("y cada entrada del mapa ARR la emite alguien", () => {
    const suben = prefijosQueSuben();
    for (const prefijo of prefijosQueBajan()) {
      expect(suben, `"${prefijo}" esta en ARR pero flatten() no lo emite`).toContain(prefijo);
    }
  });

  it("y los dos estan documentados en la cabecera del archivo", () => {
    const documentados = prefijosDocumentados();
    for (const prefijo of prefijosQueSuben()) {
      expect(documentados, `falta "${prefijo}_" en el comentario de cabecera`).toContain(prefijo);
    }
  });

  it("ningun prefijo lleva guion bajo, porque parseId corta en el primero", () => {
    for (const prefijo of prefijosQueSuben()) expect(prefijo).not.toContain("_");
  });

  it("el guardian ve las colecciones que ya habia, asi que sirve de algo", () => {
    expect(prefijosQueSuben()).toEqual(expect.arrayContaining(["ex", "rt", "se", "bw"]));
  });
});

describe("las comidas NO se sincronizan todavia, y es a proposito", () => {
  it("dayLogs no esta en flatten ni en ARR", () => {
    // Un dispositivo con una build que no conoce un tipo de documento igual
    // le estampa el shadow al bajarlo (takeRemote), y en la sincronizacion
    // siguiente su flatten() no lo emite, asi que lo lee como borrado local y
    // sube una lapida. Una build vieja en cache borra las comidas de TODOS
    // los dispositivos, y no se puede arreglar desde el lado nuevo porque el
    // codigo que estampa el shadow es el viejo.
    //
    // Si vas a agregarlo, primero hace falta una forma de que una build que
    // no entiende un tipo no suba lapidas por el. Borrar este test no
    // alcanza.
    expect(prefijosQueSuben()).not.toContain("dl");
    expect(prefijosQueBajan()).not.toContain("dl");
  });

  it("y la cabecera explica por que", () => {
    expect(FUENTE.slice(0, FUENTE.indexOf("*/"))).toContain("dayLogs");
  });
});
