import React from 'react';
import { useHistory } from 'react-router-dom';
import styled from 'styled-components';
import { Btn } from '../Components/Btn';
import { EmSpacer, Link, Spacer } from '../Components/CoreUI';
import { HideSmall, Sub, Text, White } from '../Components/Text';
import LandingPageCanvas from '../Renderers/LandingPageCanvas';
import dfstyles from '../Styles/dfstyles';
import { LandingPageRoundArt } from '../Views/LandingPageRoundArt';
import { LeadboardDisplay } from '../Views/Leaderboard';

export const enum LandingPageZIndex {
  Background = 0,
  Canvas = 1,
  BasePage = 2,
}

const links = {
  twitter: 'http://twitter.com/darkforest_eth',
  email: 'mailto:contact@zkga.me',
  blog: 'https://blog.zkga.me/',
  discord: 'https://discord.gg/2u2TN6v8r6',
  github: 'https://github.com/darkforest-eth',
};

export default function LandingPage() {
  const history = useHistory();

  return (
    <>
      <LandingPageCanvas />
      <PrettyOverlayGradient />

      <Page>
        <Spacer height={150} />

        <MainContentContainer>
          <Header>
            <LandingPageRoundArt />
            <EmSpacer height={1.5} />

            <p>
              <White>WAGMI Dark Forest</White>
              <br />
              <Text>zkSNARK space warfare</Text>
              <br />
            </p>

            <Spacer height={16} />

            <Btn
              style={{ borderRadius: '8px', padding: '4px 8px' }}
              color={dfstyles.colors.dfgreen}
              onClick={() => {
                history.push('/play');
              }}
            >
              Enter
            </Btn>

            <Spacer height={16} />

            <p>
              <Text>This instance of Dark Forest (WAGMI Round 1) is a fork of https://zkga.me. Much love to the original authors for their inspiring work.</Text>
            </p>
          </Header>

          <EmSpacer height={3} />

          <Spacer height={16} />

          <VariousLinksContainer>
            <TextLinks>
              <a href={links.email}>email</a>
              <Spacer width={4} />
              <Sub>-</Sub>
              <Spacer width={8} />
              <a href={links.blog}>blog</a>
            </TextLinks>

            <Spacer width={8} />

            <IconLinks>
              <a className={'link-twitter'} href={links.twitter}>
                <span className={'icon-twitter'}></span>
              </a>
              <Spacer width={8} />
              <a className={'link-discord'} href={links.discord}>
                <span className={'icon-discord'}></span>
              </a>
              <Spacer width={8} />
              <a className={'link-github'} href={links.github}>
                <span className={'icon-github'}></span>
              </a>
            </IconLinks>
          </VariousLinksContainer>
        </MainContentContainer>
      </Page>
    </>
  );
}

const VariousLinksContainer = styled.div`
  position: absolute;
  top: 32px;
  right: 32px;
  display: flex;
  justify-content: center;
  align-items: center;
`;

const PrettyOverlayGradient = styled.div`
  width: 100vw;
  height: 100vh;
  background: linear-gradient(to left top, rgba(219, 10, 20, 0.2), rgba(1, 255, 22, 0.2)) fixed;
  background-position: 50%, 50%;
  display: inline-block;
  position: fixed;
  top: 0;
  left: 0;
`;

const Header = styled.div`
  text-align: center;
`;

const EmailWrapper = styled.div`
  display: flex;
  flex-direction: row;
`;

const TRow = styled.tr`
  & td:first-child {
    color: ${dfstyles.colors.subtext};
  }
  & td:nth-child(2) {
    padding-left: 12pt;
  }
  & td:nth-child(3) {
    text-align: right;
    padding-left: 16pt;
  }
`;

const MainContentContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
`;

const TextLinks = styled.span`
  vertical-align: center;
  & a {
    transition: color 0.2s;

    &:hover {
      color: ${dfstyles.colors.dfblue};
    }
  }
`;

const IconLinks = styled.span`
  font-size: 18pt;

  & a {
    margin: 0 6pt;
    transition: color 0.2s;
    &:hover {
      cursor: pointer;
      &.link-twitter {
        color: ${dfstyles.colors.icons.twitter};
      }
      &.link-github {
        color: ${dfstyles.colors.icons.github};
      }
            &.link-discord {
        color: ${dfstyles.colors.icons.discord};
      }
      &.link-blog {
        color: ${dfstyles.colors.icons.blog};
      }
      &.link-email {
        color: ${dfstyles.colors.icons.email};
      }
    }
  }
`;

const Page = styled.div`
  position: absolute;
  width: 100%;
  height: 100%;
  color: white;
  font-size: ${dfstyles.fontSize};
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: ${LandingPageZIndex.BasePage};
`;

const HallOfFameTitle = styled.div`
  color: ${dfstyles.colors.subtext};
  display: inline-block;
  border-bottom: 1px solid ${dfstyles.colors.subtext};
  line-height: 1em;
`;
