import { MatchItem } from '../types';

export const generateAIMessage = async (
  match: MatchItem, 
  side: 'seller' | 'buyer', 
  channel: 'bazos' | 'sms' | 'email' = 'bazos', 
  userStyle: 'formal' | 'friendly' | 'direct' = 'friendly'
) => {
  const matchKey = `${match.offer.url || match.offer.id}__${match.demand.url || match.demand.id}`;
  
  try {
    const response = await fetch('http://localhost:3001/ai/generate-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        matchKey,
        side,
        channel,
        userStyle,
        match: {
          offer: {
            title: match.offer.title,
            price: match.offer.price,
            location: match.offer.location,
            url: match.offer.url,
          },
          demand: {
            title: match.demand.title,
            price: match.demand.price,
            location: match.demand.location,
            url: match.demand.url,
          },
          arbitrageScore: match.arbitrageScore,
          similarityScore: match.offer.similarity,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'AI generování selhalo');
    }

    const result = await response.json();
    
    if (result.success && result.message) {
      const textToCopy = channel === 'email' && result.subject ? `${result.subject}\n\n${result.message}` : result.message;
      await navigator.clipboard.writeText(textToCopy);
      alert(`✅ AI zpráva generována a zkopírována!\n\n${result.reasoning || ''}`);
      return result.message;
    } else {
      throw new Error('AI nevygenerovala zprávu');
    }
  } catch (error) {
    console.error('AI message generation failed:', error);
    alert(`❌ AI generování selhalo: ${error instanceof Error ? error.message : 'Neznámá chyba'}`);
    return null;
  }
};

export const copyTemplate = async (
  match: MatchItem, 
  side: 'seller' | 'buyer', 
  signature: string, 
  channel: 'bazos' | 'sms' | 'email' = 'bazos'
) => {
  const otherSide = side === 'seller' ? match.demand : match.offer;
  const isSeller = side === 'seller';
  let subject = '';
  let text = '';

  if (channel === 'email') {
    if (isSeller) {
      subject = `${otherSide.title} - nabídka k prodeji`;
      text = [
        `Dobrý den,`, ``,
        `narazil jsem na Váš inzerát "${otherSide.title}" a mám pro Vás zajímavou nabídku.`, ``,
        `K dispozici mám ${otherSide.title} za ${otherSide.price}.`, ``,
        `Pokud máte zájem, mohu Vám poslat více informací včetně fotografií a detailů o stavu zařízení.`, ``,
        `Napište mi prosím, zda Vás tato nabídka zaujala.`, ``,
        `Hezký den,`, signature, ``,
        `--`, `Tel: [Váš telefon]`, `Email: [Váš email]`,
      ].join('\n');
    } else {
      subject = `Nabídka: ${otherSide.title} za ${otherSide.price}`;
      text = [
        `Dobrý den,`, ``,
        `viděl jsem Váš inzerát "${otherSide.title}" a mám pro Vás konkrétní nabídku.`, ``,
        `Mám k dispozici ${otherSide.title} který přesně odpovídá Vašemu zájmu. Cena je ${otherSide.price}.`, ``,
        `Zařízení je plně funkční, vše bylo testováno.`, ``,
        `Pokud máte zájem, mohu Vám poslat další informace a domluvit se na způsobu předání.`, ``,
        `Napište mi prosím, zda Vás nabídka zaujala.`, ``,
        `Hezký den,`, signature, ``,
        `--`, `Tel: [Váš telefon]`, `Email: [Váš email]`,
      ].join('\n');
    }
  } else if (channel === 'sms') {
    if (isSeller) {
      text = `Dobrý den, mám ${otherSide.title} za ${otherSide.price}. Máte zájem? Více info pošlu. Děkuji, ${signature}`;
    } else {
      text = `Dobrý den, mám ${otherSide.title} za ${otherSide.price}. Přesně co hledáte. Zájem? Děkuji, ${signature}`;
    }
    if (text.length > 160) {
      text = text.substring(0, 157) + '...';
    }
  } else {
    if (isSeller) {
      text = [
        `Dobrý den,`, ``,
        `mám ${otherSide.title} za ${otherSide.price}.`, ``,
        `Zařízení je plně funkční, vše bylo testováno.`, ``,
        `Pokud máte zájem, napište mi prosím více informací.`, ``,
        `Hezký den, ${signature}`,
      ].join('\n');
    } else {
      text = [
        `Dobrý den,`, ``,
        `viděl jsem Váš inzerát. Mám k dispozici ${otherSide.title} za ${otherSide.price}.`, ``,
        `Zařízení je plně funkční.`, ``,
        `Napište mi prosím, zda máte zájem.`, ``,
        `Hezký den, ${signature}`,
      ].join('\n');
    }
  }

  await navigator.clipboard.writeText(text);

  if (channel === 'email' && subject) {
    await navigator.clipboard.writeText(subject + '\n\n' + text);
    alert(`Předmět a text e-mailu zkopírovány do schránky.\n\nPředmět: ${subject}`);
  }
};
