import { getAllAds } from './database.js';

/**
 * Tento soubor byl znovu vytvořen, protože původní verze nebyla uložena na disku.
 * 
 * Chyba: "Argument typu string | undefined nejde přiřadit k parametru typu string"
 * se opravuje ošetřením hodnoty, která může být undefined.
 */

async function testExtraction() {
    const ads = await getAllAds();
    const firstAd = ads[0];

    if (firstAd) {
        // PŘÍKLAD OPRAVY:
        // Pokud firstAd.title může být undefined, použijeme ?? "" pro výchozí hodnotu.
        const title: string = firstAd.title ?? "Neznámý inzerát";
        console.log("Testuji:", title);

        // Nebo pokud víme, že tam hodnota 100% bude, použijeme '!'
        // console.log("Testuji:", firstAd.title!);
    }
}

testExtraction().catch(console.error);
