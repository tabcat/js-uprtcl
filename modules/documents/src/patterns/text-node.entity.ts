import { html, TemplateResult } from 'lit-element';
import { injectable, inject } from 'inversify';
import { Store } from 'redux';

import {
  Pattern,
  HasActions,
  PatternAction,
  Hashed,
  Hashable,
  CortexTypes,
  Creatable,
  PatternRecognizer,
  HasChildren,
  Entity
} from '@uprtcl/cortex';
import { Mergeable, MergeStrategy, mergeStrings, mergeResult } from '@uprtcl/evees';
import { Lens, HasLenses } from '@uprtcl/lenses';
import { ReduxTypes, i18nTypes } from '@uprtcl/micro-orchestrator';

import { TextNode, TextType, DocumentsTypes } from '../types';
import { Documents } from '../services/documents';

const propertyOrder = ['text', 'type', 'links'];

@injectable()
export class TextNodeEntity implements Entity {
  constructor(@inject(CortexTypes.Core.Hashed) protected hashedPattern: Pattern & Hashable<any>) {}
  recognize(object: object): boolean {
    if (!this.hashedPattern.recognize(object)) return false;

    const node = this.hashedPattern.extract(object as Hashed<any>);
    return propertyOrder.every(p => node.hasOwnProperty(p));
  }

  name = 'TextNode';
}

@injectable()
export class TextNodePatterns extends TextNodeEntity implements HasLenses, HasChildren, Mergeable {
  constructor(
    @inject(CortexTypes.Core.Hashed) protected hashedPattern: Pattern & Hashable<any>,
    @inject(i18nTypes.Translate) protected t: (key: string) => string
  ) {
    super(hashedPattern);
  }

  replaceChildrenLinks = (node: Hashed<TextNode>) => (
    childrenHashes: string[]
  ): Hashed<TextNode> => ({
    ...node,
    object: {
      ...node.object,
      links: childrenHashes
    }
  });

  getChildrenLinks = (node: Hashed<TextNode>): string[] => node.object.links;

  links = async (node: Hashed<TextNode>) => this.getChildrenLinks(node);

  lenses = (node: Hashed<TextNode>): Lens[] => {
    return [
      {
        name: this.t('documents:document'),
        tag: 'content',
        render: (lensContent: TemplateResult) => html`
          <documents-text-node .data=${node.object}>${lensContent}</documents-text-node>
        `
      }
    ];
  };

  merge = (originalNode: Hashed<TextNode>) => async (
    modifications: Hashed<TextNode>[],
    mergeStrategy: MergeStrategy
  ): Promise<TextNode> => {
    const resultText = mergeStrings(
      originalNode.object.text,
      modifications.map(data => data.object.text)
    );
    const resultType = mergeResult(
      originalNode.object.type,
      modifications.map(data => data.object.type)
    );

    const mergedLinks = await mergeStrategy.mergeLinks(
      originalNode.object.links,
      modifications.map(data => data.object.links)
    );

    return {
      links: mergedLinks,
      text: resultText,
      type: resultType
    };
  };
}

@injectable()
export class TextNodeActions extends TextNodeEntity implements HasActions {
  constructor(
    @inject(CortexTypes.Core.Hashed) protected hashedPattern: Pattern & Hashable<any>,
    @inject(CortexTypes.Recognizer) protected recognizer: PatternRecognizer
  ) {
    super(hashedPattern);
  }

  actions = (node: Hashed<TextNode>): PatternAction[] => {
    const textNode = node.object;

    if (textNode.type === TextType.Paragraph) {
      return [
        {
          icon: 'title',
          title: 'To title',
          action: (changeContent: (newContent: any) => void) => {
            changeContent({ ...textNode, type: TextType.Title });
          },
          type: 'formatting'
        }
      ];
    } else {
      return [
        {
          icon: 'text_fields',
          title: 'To paragraph',
          action: (changeContent: (newContent: any) => void) => {
            changeContent({ ...textNode, type: TextType.Paragraph });
          },
          type: 'formatting'
        }
      ];
    }
  };
}

@injectable()
export class TextNodeCreate implements Pattern, Creatable<Partial<TextNode>, TextNode> {
  constructor(@inject(DocumentsTypes.Documents) protected documents: Documents) {}
  recognize(object: object): boolean {
    return propertyOrder.every(p => object.hasOwnProperty(p));
  }

  create = () => async (
    node: Partial<TextNode> | undefined,
    upl?: string
  ): Promise<Hashed<TextNode>> => {
    const links = node && node.links ? node.links : [];
    const text = node && node.text ? node.text : '';
    const type = node && node.type ? node.type : TextType.Paragraph;

    if (!upl) {
      upl = this.documents.service.remote.getAllServicesUpl().find(upl => !upl.includes('http'));
    }

    const newTextNode = { links, text, type };
    return this.documents.createTextNode(newTextNode, upl);
  };
}
